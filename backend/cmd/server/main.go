package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"itms/backend/internal/api"
	"itms/backend/internal/app"
	"itms/backend/internal/inventorysync"
	"itms/backend/internal/platform/authn"
	"itms/backend/internal/platform/database"
)

func startWarrantyAlertChecker(ctx context.Context, db *sql.DB) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	// Run immediately on startup
	checkWarrantyExpiry(db)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			checkWarrantyExpiry(db)
		}
	}
}

func checkWarrantyExpiry(db *sql.DB) {
	rows, err := db.Query(`
		SELECT a.id, a.asset_tag, a.name, a.assigned_to, a.warranty_until,
		       a.maintenance_until,
		       EXTRACT(DAY FROM (a.warranty_until - CURRENT_DATE))::INTEGER AS days_remaining
		FROM assets a
		WHERE a.warranty_until IS NOT NULL
		  AND a.warranty_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
		  AND a.status != 'decommissioned'
		ORDER BY a.warranty_until ASC
	`)
	if err != nil {
		log.Printf("warranty alert checker: failed to query assets: %v", err)
		return
	}
	defer rows.Close()

	alertCount := 0
	for rows.Next() {
		var assetID, assetTag, assetName, assignedTo, warrantyUntil, maintenanceUntil sql.NullString
		var daysRemaining int

		if err := rows.Scan(&assetID, &assetTag, &assetName, &assignedTo, &warrantyUntil, &maintenanceUntil, &daysRemaining); err != nil {
			log.Printf("warranty alert checker: failed to scan row: %v", err)
			continue
		}

		// Skip if no assigned user
		if !assignedTo.Valid || assignedTo.String == "" {
			continue
		}

		// Skip if asset is in maintenance window
		if maintenanceUntil.Valid && maintenanceUntil.String != "" {
			maintenanceTime, parseErr := time.Parse(time.RFC3339, maintenanceUntil.String)
			if parseErr == nil && time.Now().UTC().Before(maintenanceTime) {
				continue
			}
		}

		// Determine severity based on days remaining
		var severity string
		if daysRemaining <= 7 {
			severity = "critical"
		} else if daysRemaining <= 30 {
			severity = "warning"
		} else {
			severity = "info"
		}

		title := "Warranty expiring soon"
		detail := ""
		if assetName.Valid && assetName.String != "" {
			detail = assetName.String + " warranty expires in " + formatDays(daysRemaining)
		} else {
			detail = assetTag.String + " warranty expires in " + formatDays(daysRemaining)
		}

		// Check for existing alert in last 12 hours to avoid duplicates
		var existingID string
		err := db.QueryRow(`
			SELECT id
			FROM alerts
			WHERE user_id = $1::uuid
			  AND device_id = $2::uuid
			  AND source = 'warranty'
			  AND resolved = FALSE
			  AND created_at >= NOW() - INTERVAL '7 days'
			ORDER BY created_at DESC
			LIMIT 1
		`, assignedTo.String, assetID.String).Scan(&existingID)
		
		if err == nil {
			// Alert already exists, skip
			continue
		}
		if err != nil && err != sql.ErrNoRows {
			log.Printf("warranty alert checker: failed to check existing alert: %v", err)
			continue
		}

		// Insert new alert
		_, err = db.Exec(`
			INSERT INTO alerts (user_id, device_id, source, severity, title, detail, acknowledged, resolved, created_at)
			VALUES ($1::uuid, $2::uuid, 'warranty', $3, $4, $5, FALSE, FALSE, NOW())
		`, assignedTo.String, assetID.String, severity, title, detail)
		
		if err != nil {
			log.Printf("warranty alert checker: failed to insert alert for %s: %v", assetTag.String, err)
			continue
		}

		alertCount++
	}

	if alertCount > 0 {
		log.Printf("warranty alert checker: created %d warranty expiry alerts", alertCount)
	}
}

func formatDays(days int) string {
	if days == 0 {
		return "today"
	} else if days == 1 {
		return "1 day"
	} else {
		return fmt.Sprintf("%d days", days)
	}
}

func main() {
	config, err := app.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}

	db, err := database.Open(config.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := database.Migrate(db, config.MigrationDir); err != nil {
		log.Fatal(err)
	}

	if err := database.Seed(db, config, authn.HashPassword); err != nil {
		log.Fatal(err)
	}
	for _, warning := range config.SecurityWarnings() {
		log.Printf("security warning: %s", warning)
	}
	if errors := config.SecurityErrors(); len(errors) > 0 {
		for _, securityError := range errors {
			log.Printf("security error: %s", securityError)
		}
		log.Fatal("refusing to start with insecure configuration while ITMS_ENFORCE_SECURITY=true")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	syncService := inventorysync.NewService(db, inventorysync.Config{
		Enabled:           config.InventorySyncEnabled,
		SourceType:        config.InventorySyncSourceType,
		SourceURL:         config.InventorySyncSourceURL,
		SourceToken:       config.InventorySyncSourceToken,
		IngestToken:       config.InventoryIngestToken,
		Interval:          config.InventorySyncInterval,
		RunOnStartup:      config.InventorySyncRunOnStartup,
		DefaultEntityID:   config.InventorySyncDefaultEntityID,
		DefaultDeptID:     config.InventorySyncDefaultDeptID,
		DefaultLocationID: config.InventorySyncDefaultLocationID,
	})
	syncService.Start(ctx)

	// Start warranty expiry alert checker
	go startWarrantyAlertChecker(ctx, db)
	log.Printf("warranty alert checker started (runs every 24 hours)")

	router := api.NewRouter(db, config, syncService)
	log.Printf("backend listening on %s", config.Address)

	server := &http.Server{
		Addr:              config.Address,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      11 * time.Minute,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Fatal(err)
		}
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}
}
