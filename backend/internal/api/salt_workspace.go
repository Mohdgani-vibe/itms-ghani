package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

func (server *apiServer) saltWorkspace(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}

	recentItemsLimit := parseRecentItemsLimit(c.Query("limit"), 12)

	assets, summary, err := server.loadSaltWorkspaceAssets(c)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	recentExecutions, err := server.loadSaltWorkspaceRecentExecutions(recentItemsLimit)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	jobHistory, err := server.loadSaltWorkspaceJobHistory(recentItemsLimit)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	slsFiles, err := server.loadSaltWorkspaceSLSFiles()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"generatedAt":      time.Now().UTC(),
		"summary":          summary,
		"assets":           assets,
		"recentExecutions": recentExecutions,
		"jobHistory":       jobHistory,
		"slsFiles":         slsFiles,
		"executionPolicy":  terminalPolicyPayload(),
		"presets":          saltWorkspacePresets(),
		"integrations": gin.H{
			"saltApiConfigured": server.salt != nil && server.salt.Enabled(),
		},
	})
}

func parseRecentItemsLimit(raw string, defaultLimit int) int {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return defaultLimit
	}

	parsed, err := strconv.Atoi(trimmed)
	if err != nil || parsed <= 0 {
		return defaultLimit
	}
	if parsed > 100 {
		return 100
	}
	return parsed
}

func (server *apiServer) loadSaltWorkspaceSLSFiles() ([]string, error) {
	root := "/srv/salt"
	files := make([]string, 0)
	if _, err := os.Stat(root); err != nil {
		if os.IsNotExist(err) {
			return files, nil
		}
		return nil, err
	}

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".sls") {
			return nil
		}
		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		normalized := normalizeSaltWorkspaceSLSName(relPath)
		if normalized != "" {
			files = append(files, normalized)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	return files, nil
}

func normalizeSaltWorkspaceSLSName(relPath string) string {
	normalized := strings.TrimSuffix(filepath.ToSlash(relPath), ".sls")
	normalized = strings.Trim(normalized, "/")
	normalized = strings.TrimSuffix(normalized, "/init")
	return strings.Trim(normalized, "/")
}

func (server *apiServer) loadSaltWorkspaceAssets(c *gin.Context) ([]gin.H, gin.H, error) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		return nil, nil, fmt.Errorf("unauthorized")
	}

	whereClauses := []string{"a.is_compute = TRUE"}
	args := make([]any, 0, 4)
	argIndex := 1

	if claims.Role != "super_admin" {
		entityArg := argIndex
		userArg := argIndex + 1
		whereClauses = append(whereClauses, fmt.Sprintf("(a.entity_id = $%d::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $%d::uuid AND uea.entity_id = a.entity_id))", entityArg, userArg))
		args = append(args, claims.EntityID, claims.UserID)
	}

	rows, err := server.db.Query(`
		SELECT a.id,
			COALESCE(a.asset_tag, ''),
			COALESCE(NULLIF(a.hostname, ''), a.asset_tag),
			COALESCE(a.name, ''),
			COALESCE(a.category, ''),
			COALESCE(cd.os_name, ''),
			COALESCE(cd.last_seen::text, ''),
			COALESCE(a.status, ''),
			COALESCE(a.cost::text, ''),
			COALESCE(a.salt_minion_id, ''),
			COALESCE(u.full_name, ''),
			COALESCE(d.name, ''),
			COALESCE(l.full_name, ''),
			COALESCE(alerts.open_alerts, 0),
			COALESCE(cd.pending_updates, 0)
		FROM assets a
		LEFT JOIN asset_compute_details cd ON cd.asset_id = a.id
		LEFT JOIN users u ON u.id = a.assigned_to
		LEFT JOIN departments d ON d.id = a.dept_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN (
			SELECT asset_id, COUNT(*) AS open_alerts
			FROM asset_alerts
			WHERE is_resolved = FALSE
			GROUP BY asset_id
		) alerts ON alerts.asset_id = a.id
		WHERE `+strings.Join(whereClauses, " AND ")+`
		ORDER BY COALESCE(alerts.open_alerts, 0) DESC, cd.last_seen DESC NULLS LAST, a.asset_tag ASC
	`, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	totalAssets := 0
	linkedTargets := 0
	connectedTargets := 0
	alertBacklog := 0
	pendingActions := 0
	totalRiskScore := 0

	for rows.Next() {
		var id, assetTag, hostname, assetName, deviceType, osName, lastSeenAt, status, cost, saltMinionID, ownerName, departmentName, locationName string
		var openAlerts, pendingUpdates int
		if err := rows.Scan(&id, &assetTag, &hostname, &assetName, &deviceType, &osName, &lastSeenAt, &status, &cost, &saltMinionID, &ownerName, &departmentName, &locationName, &openAlerts, &pendingUpdates); err != nil {
			return nil, nil, err
		}

		totalAssets++
		alertBacklog += openAlerts
		patchStatus := compatPatchStatus(pendingUpdates)
		alertStatus := compatAlertStatus(openAlerts)
		if patchStatus != "up_to_date" {
			pendingActions++
		}

		target := strings.TrimSpace(saltMinionID)
		if target == "" {
			target = strings.TrimSpace(hostname)
		}
		connectedPtr := saltConnectionStatus(c.Request.Context(), server.salt, target)
		connected := connectedPtr != nil && *connectedPtr
		if strings.TrimSpace(saltMinionID) != "" {
			linkedTargets++
		}
		if connected {
			connectedTargets++
		}

		riskScore := saltWorkspaceRiskScore(openAlerts, pendingUpdates, status, connectedPtr)
		totalRiskScore += riskScore

		items = append(items, gin.H{
			"id":             id,
			"assetId":        assetTag,
			"assetTag":       assetTag,
			"assetName":      emptyToNil(strings.TrimSpace(assetName)),
			"hostname":       hostname,
			"deviceType":     emptyToNil(strings.TrimSpace(deviceType)),
			"osName":         emptyToNil(strings.TrimSpace(osName)),
			"lastSeenAt":     emptyToNil(strings.TrimSpace(lastSeenAt)),
			"status":         strings.TrimSpace(status),
			"cost":           emptyToNil(strings.TrimSpace(cost)),
			"saltMinionId":   emptyToNil(strings.TrimSpace(saltMinionID)),
			"ownerName":      emptyToNil(strings.TrimSpace(ownerName)),
			"departmentName": emptyToNil(strings.TrimSpace(departmentName)),
			"locationName":   emptyToNil(strings.TrimSpace(locationName)),
			"pendingAlerts":  openAlerts,
			"patchStatus":    patchStatus,
			"alertStatus":    alertStatus,
			"connected":      connected,
			"riskScore":      riskScore,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	averageRiskScore := 0
	if totalAssets > 0 {
		averageRiskScore = totalRiskScore / totalAssets
	}

	return items, gin.H{
		"totalAssets":      totalAssets,
		"linkedTargets":    linkedTargets,
		"connectedTargets": connectedTargets,
		"alertBacklog":     alertBacklog,
		"pendingActions":   pendingActions,
		"averageRiskScore": averageRiskScore,
	}, nil
}

func (server *apiServer) loadSaltWorkspaceRecentExecutions(limit int) ([]gin.H, error) {
	rows, err := server.db.Query(fmt.Sprintf(`
		SELECT h.id, COALESCE(a.hostname, a.asset_tag), h.detail, h.created_at
		FROM asset_history h
		JOIN assets a ON a.id = h.asset_id
		WHERE h.action = 'patch_run'
		ORDER BY h.created_at DESC
		LIMIT %d
	`, limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id, scope string
		var detailRaw []byte
		var createdAt time.Time
		if err := rows.Scan(&id, &scope, &detailRaw, &createdAt); err != nil {
			return nil, err
		}
		var detail map[string]any
		_ = json.Unmarshal(detailRaw, &detail)
		items = append(items, gin.H{
			"id":        id,
			"jid":       id,
			"scope":     scope,
			"status":    patchRunStatus(detail),
			"createdAt": createdAt,
			"updatedAt": createdAt,
		})
	}
	return items, rows.Err()
	}

func (server *apiServer) loadSaltWorkspaceJobHistory(limit int) ([]gin.H, error) {
	rows, err := server.db.Query(fmt.Sprintf(`
		SELECT r.id::text, r.scope_label, r.requested_at, r.completed_at, r.success_count, r.failed_count, r.row_count, COALESCE(u.full_name, '')
		FROM patch_run_reports r
		LEFT JOIN users u ON u.id = r.actor_id
		ORDER BY r.created_at DESC
		LIMIT %d
	`, limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id, scopeLabel, requestedBy string
		var requestedAt, completedAt time.Time
		var successCount, failedCount, rowCount int
		if err := rows.Scan(&id, &scopeLabel, &requestedAt, &completedAt, &successCount, &failedCount, &rowCount, &requestedBy); err != nil {
			return nil, err
		}
		items = append(items, gin.H{
			"id":           id,
			"scopeLabel":   scopeLabel,
			"requestedAt":  requestedAt,
			"completedAt":  completedAt,
			"successCount": successCount,
			"failedCount":  failedCount,
			"rowCount":     rowCount,
			"requestedBy":  emptyToNil(strings.TrimSpace(requestedBy)),
		})
	}
	return items, rows.Err()
}

func saltWorkspacePresets() []gin.H {
	return []gin.H{
		{"id": "pkg-refresh", "label": "Refresh package metadata", "command": "state.apply patch.run", "category": "State", "description": "Queue the standard patch orchestration state for the selected endpoint."},
		{"id": "service-health", "label": "Salt minion service health", "command": "systemctl status salt-minion", "category": "Diagnostics", "description": "Verify that the endpoint Salt service is active before execution."},
		{"id": "disk-check", "label": "Disk capacity check", "command": "df -h", "category": "Diagnostics", "description": "Inspect available capacity before running content-heavy states."},
		{"id": "os-facts", "label": "Host identity", "command": "hostname", "category": "Diagnostics", "description": "Confirm that the selected endpoint matches the intended Salt target."},
	}
}

func saltWorkspaceRiskScore(openAlerts int, pendingUpdates int, status string, connected *bool) int {
	riskScore := (openAlerts * 14) + (pendingUpdates * 6)
	if connected != nil && !*connected {
		riskScore += 12
	}
	if strings.EqualFold(strings.TrimSpace(status), "retired") {
		riskScore -= 8
	}
	if riskScore < 0 {
		return 0
	}
	if riskScore > 100 {
		return 100
	}
	return riskScore
}