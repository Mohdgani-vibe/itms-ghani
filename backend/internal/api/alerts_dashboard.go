package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/authn"
	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

type alertsDashboardRecord struct {
	ID           string
	AssetID      string
	AssetTag     string
	AssetName    string
	Hostname     string
	DeviceID     string
	UserID       string
	UserName     string
	UserEmail    string
	Department   string
	Source       string
	SourceLabel  string
	SourceRaw    string
	Severity     string
	Title        string
	Detail       string
	Acknowledged bool
	Resolved     bool
	CreatedAt    time.Time
}

type alertsDashboardSystemRow struct {
	Key          string
	AssetID      string
	AssetTag     string
	Hostname     string
	Username     string
	UserEmail    string
	Department   string
	Module       string
	ModuleLabel  string
	Status       string
	ErrorCount   int
	ErrorDetails []string
	LastScanAt   time.Time
	LatestAlert  alertsDashboardRecord
}

type alertsDashboardDepartmentRow struct {
	Key          string
	Name         string
	TotalSystems int
	CleanCount   int
	ErrorCount   int
	LastUpdated  time.Time
	Systems      []alertsDashboardSystemRow
}

type alertsDashboardTrendBucket struct {
	Date  string
	Count int
}

func (server *apiServer) alertsDashboard(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	server.alertsDashboardByOwner(c, claims.Role == "employee", claims.UserID)
}

func (server *apiServer) listMyAlertsDashboard(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	server.alertsDashboardByOwner(c, true, claims.UserID)
}

func (server *apiServer) alertsDashboardByOwner(c *gin.Context, restrict bool, userID string) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	selectedSource := normalizeAlertsDashboardSource(c.Query("source"))
	selectedDepartment := normalizeAlertsDashboardDepartment(c.Query("department"))
	statusFilter := normalizeAlertsDashboardStatus(c.Query("status"))
	searchQuery := strings.ToLower(strings.TrimSpace(c.Query("search")))

	records, err := server.loadAlertsDashboardRecords(claims, restrict, userID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	moduleCards := buildAlertsDashboardModuleCards(records)
	sourceRecords := filterAlertsDashboardRecordsBySource(records, selectedSource)
	sourceSystems := buildAlertsDashboardSystemRows(sourceRecords)
	departments := buildAlertsDashboardDepartmentRows(sourceSystems)
	filteredSystems := filterAlertsDashboardSystemRows(sourceSystems, selectedDepartment, searchQuery, statusFilter)
	reportSystems := filterAlertsDashboardSystemRows(sourceSystems, selectedDepartment, "", "all")
	reportDetails := buildAlertsDashboardErrorDetails(sourceRecords, selectedDepartment)
	trend := buildAlertsDashboardTrend(sourceRecords)

	httpx.JSON(c, http.StatusOK, gin.H{
		"source":      selectedSource,
		"sourceLabel": alertsDashboardModuleLabel(selectedSource),
		"filters": gin.H{
			"department": selectedDepartment,
			"search":     searchQuery,
			"status":     statusFilter,
		},
		"moduleCards": moduleCards,
		"trend":       trend,
		"departments": buildAlertsDashboardDepartmentPayload(departments),
		"systems":     buildAlertsDashboardSystemPayload(filteredSystems),
		"report": gin.H{
			"generatedAt":        time.Now().UTC(),
			"departmentSummary":  buildAlertsDashboardDepartmentPayload(departments),
			"systemStatuses":     buildAlertsDashboardSystemPayload(reportSystems),
			"errorDetails":       reportDetails,
			"last7DaysTrend":     trend,
			"module":             selectedSource,
			"moduleLabel":        alertsDashboardModuleLabel(selectedSource),
			"selectedDepartment": selectedDepartment,
		},
	})
}

func (server *apiServer) loadAlertsDashboardRecords(claims *authn.Claims, restrict bool, userID string) ([]alertsDashboardRecord, error) {
	sourceKeyExpr := alertSourceKeyExpr("al.source")
	sourceLabelExpr := alertSourceLabelExpr("al.source")
	departmentExpr := `COALESCE(NULLIF(ad.name, ''), NULLIF(ud.name, ''), 'Unassigned')`
	baseFrom := `
		FROM alerts al
		LEFT JOIN assets a ON a.id = al.device_id
		LEFT JOIN users u ON u.id = al.user_id
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
	`
	whereClauses := []string{"1 = 1"}
	args := []any{}
	argIndex := 1
	if restrict {
		whereClauses = append(whereClauses, fmt.Sprintf("al.user_id = $%d::uuid", argIndex))
		args = append(args, userID)
		argIndex++
	} else if claims.Role != "super_admin" {
		entityArg := argIndex
		userArg := argIndex + 1
		whereClauses = append(whereClauses, fmt.Sprintf("(COALESCE(a.entity_id, u.entity_id) = $%d::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $%d::uuid AND uea.entity_id = COALESCE(a.entity_id, u.entity_id)))", entityArg, userArg))
		args = append(args, claims.EntityID, claims.UserID)
		argIndex += 2
	}
	whereClauses = append(whereClauses, sourceKeyExpr+` IN ('wazuh', 'openscap', 'clamav')`)
	whereSQL := strings.Join(whereClauses, " AND ")

	rows, err := server.db.Query(`
		SELECT al.id,
			COALESCE(a.id::text, ''), COALESCE(a.asset_tag, ''), COALESCE(a.name, ''), COALESCE(a.hostname, ''),
			COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''),
			`+departmentExpr+`,
			`+sourceKeyExpr+` AS source_key,
			`+sourceLabelExpr+` AS source_label,
			COALESCE(al.source, ''), al.severity, al.title, COALESCE(al.detail, ''), al.acknowledged, al.resolved, al.created_at
		`+baseFrom+`
		WHERE `+whereSQL+`
		ORDER BY al.created_at DESC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]alertsDashboardRecord, 0)
	for rows.Next() {
		var item alertsDashboardRecord
		if err := rows.Scan(&item.ID, &item.AssetID, &item.AssetTag, &item.AssetName, &item.Hostname, &item.UserID, &item.UserName, &item.UserEmail, &item.Department, &item.Source, &item.SourceLabel, &item.SourceRaw, &item.Severity, &item.Title, &item.Detail, &item.Acknowledged, &item.Resolved, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.DeviceID = item.AssetID
		if item.Department == "" {
			item.Department = "Unassigned"
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func normalizeAlertsDashboardSource(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "wazuh", "openscap", "clamav":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "wazuh"
	}
}

func normalizeAlertsDashboardDepartment(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	return trimmed
}

func normalizeAlertsDashboardStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "clean", "error":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "all"
	}
}

func filterAlertsDashboardRecordsBySource(records []alertsDashboardRecord, source string) []alertsDashboardRecord {
	filtered := make([]alertsDashboardRecord, 0, len(records))
	for _, record := range records {
		if record.Source == source {
			filtered = append(filtered, record)
		}
	}
	return filtered
}

func alertsDashboardSystemKey(record alertsDashboardRecord) string {
	for _, candidate := range []string{record.AssetID, record.DeviceID, record.Hostname, record.AssetTag, record.ID} {
		trimmed := strings.TrimSpace(candidate)
		if trimmed != "" {
			return trimmed
		}
	}
	return record.ID
}

func alertsDashboardModuleLabel(source string) string {
	switch source {
	case "wazuh":
		return "Wazuh"
	case "openscap":
		return "Hardening / OpenSCAP"
	case "clamav":
		return "ClamScan"
	default:
		return source
	}
}

func alertsDashboardModuleCardLabel(source string) string {
	return alertsDashboardModuleLabel(source) + " Alerts"
}

func alertsDashboardIsError(record alertsDashboardRecord) bool {
	severity := strings.ToLower(strings.TrimSpace(record.Severity))
	title := strings.ToLower(strings.TrimSpace(record.Title))
	if record.Resolved {
		return false
	}
	if strings.Contains(title, "clean") {
		return false
	}
	return severity == "critical" || severity == "high" || severity == "medium" || severity == "warning" || severity == "error"
}

func alertsDashboardMatchesSearch(row alertsDashboardSystemRow, query string) bool {
	if query == "" {
		return true
	}
	haystack := strings.ToLower(strings.Join([]string{row.AssetID, row.AssetTag, row.Hostname, row.Username, row.UserEmail, row.Department, row.ModuleLabel}, " "))
	return strings.Contains(haystack, query)
}

func buildAlertsDashboardSystemRows(records []alertsDashboardRecord) []alertsDashboardSystemRow {
	systemMap := make(map[string]*alertsDashboardSystemRow)
	for _, record := range records {
		key := alertsDashboardSystemKey(record)
		row, exists := systemMap[key]
		if !exists {
			row = &alertsDashboardSystemRow{
				Key:         key,
				AssetID:     record.AssetID,
				AssetTag:    record.AssetTag,
				Hostname:    alertsDashboardFirstNonEmpty(record.Hostname, record.AssetName, record.AssetTag, record.AssetID, record.ID),
				Username:    alertsDashboardFirstNonEmpty(record.UserName, record.UserEmail, "Unassigned"),
				UserEmail:   record.UserEmail,
				Department:  alertsDashboardFirstNonEmpty(record.Department, "Unassigned"),
				Module:      record.Source,
				ModuleLabel: alertsDashboardModuleLabel(record.Source),
				LastScanAt:  record.CreatedAt,
				LatestAlert: record,
			}
			systemMap[key] = row
		}
		if record.CreatedAt.After(row.LastScanAt) {
			row.LastScanAt = record.CreatedAt
			row.LatestAlert = record
		}
		if alertsDashboardIsError(record) {
			row.ErrorCount++
			detail := strings.TrimSpace(alertsDashboardFirstNonEmpty(record.Title, record.Detail))
			if detail != "" && !containsString(row.ErrorDetails, detail) {
				row.ErrorDetails = append(row.ErrorDetails, detail)
			}
		}
	}

	result := make([]alertsDashboardSystemRow, 0, len(systemMap))
	for _, row := range systemMap {
		if alertsDashboardIsError(row.LatestAlert) || row.ErrorCount > 0 {
			row.Status = "error"
		} else {
			row.Status = "clean"
		}
		if len(row.ErrorDetails) == 0 {
			row.ErrorDetails = []string{"No active errors"}
		}
		result = append(result, *row)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Status != result[j].Status {
			return result[i].Status == "error"
		}
		return result[i].LastScanAt.After(result[j].LastScanAt)
	})
	return result
}

func buildAlertsDashboardDepartmentRows(systems []alertsDashboardSystemRow) []alertsDashboardDepartmentRow {
	departmentMap := make(map[string]*alertsDashboardDepartmentRow)
	for _, system := range systems {
		key := alertsDashboardFirstNonEmpty(system.Department, "Unassigned")
		department, exists := departmentMap[key]
		if !exists {
			department = &alertsDashboardDepartmentRow{Key: key, Name: key}
			departmentMap[key] = department
		}
		department.TotalSystems++
		if system.Status == "error" {
			department.ErrorCount++
		} else {
			department.CleanCount++
		}
		if system.LastScanAt.After(department.LastUpdated) {
			department.LastUpdated = system.LastScanAt
		}
		department.Systems = append(department.Systems, system)
	}

	result := make([]alertsDashboardDepartmentRow, 0, len(departmentMap))
	for _, department := range departmentMap {
		result = append(result, *department)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].ErrorCount != result[j].ErrorCount {
			return result[i].ErrorCount > result[j].ErrorCount
		}
		return result[i].Name < result[j].Name
	})
	return result
}

func buildAlertsDashboardModuleCards(records []alertsDashboardRecord) []gin.H {
	orderedSources := []string{"wazuh", "openscap", "clamav"}
	result := make([]gin.H, 0, len(orderedSources))
	for _, source := range orderedSources {
		rows := buildAlertsDashboardSystemRows(filterAlertsDashboardRecordsBySource(records, source))
		cleanCount := 0
		errorCount := 0
		var lastUpdated time.Time
		for _, row := range rows {
			if row.Status == "error" {
				errorCount++
			} else {
				cleanCount++
			}
			if row.LastScanAt.After(lastUpdated) {
				lastUpdated = row.LastScanAt
			}
		}
		statusColor := "green"
		if errorCount > 0 && cleanCount > 0 {
			statusColor = "yellow"
		} else if errorCount > 0 {
			statusColor = "red"
		}
		result = append(result, gin.H{
			"source":             source,
			"label":              alertsDashboardModuleCardLabel(source),
			"moduleLabel":        alertsDashboardModuleLabel(source),
			"totalSystemsScanned": len(rows),
			"cleanSystemsCount":  cleanCount,
			"errorSystemsCount":  errorCount,
			"lastUpdated":        lastUpdated,
			"statusColor":        statusColor,
		})
	}
	return result
}

func buildAlertsDashboardTrend(records []alertsDashboardRecord) gin.H {
	now := time.Now().UTC()
	startCurrent := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -6)
	startPrevious := startCurrent.AddDate(0, 0, -7)
	buckets := make([]alertsDashboardTrendBucket, 0, 7)
	currentDaily := make(map[string]int)
	currentTotal := 0
	previousTotal := 0
	for _, record := range records {
		if !alertsDashboardIsError(record) {
			continue
		}
		bucketDate := record.CreatedAt.UTC().Format("2006-01-02")
		if !record.CreatedAt.Before(startCurrent) {
			currentDaily[bucketDate]++
			currentTotal++
			continue
		}
		if !record.CreatedAt.Before(startPrevious) {
			previousTotal++
		}
	}
	for offset := 0; offset < 7; offset++ {
		bucketTime := startCurrent.AddDate(0, 0, offset)
		bucketDate := bucketTime.Format("2006-01-02")
		buckets = append(buckets, alertsDashboardTrendBucket{Date: bucketDate, Count: currentDaily[bucketDate]})
	}
	delta := currentTotal - previousTotal
	direction := "flat"
	if delta > 0 {
		direction = "up"
	} else if delta < 0 {
		direction = "down"
	}
	percentChange := 0.0
	if previousTotal > 0 {
		percentChange = (float64(delta) / float64(previousTotal)) * 100
	} else if currentTotal > 0 {
		percentChange = 100
	}
	return gin.H{
		"dailyBuckets":   buckets,
		"last7DaysTotal": currentTotal,
		"previous7Days":  previousTotal,
		"trendDirection": direction,
		"trendDelta":     delta,
		"trendPercent":   percentChange,
	}
}

func filterAlertsDashboardSystemRows(rows []alertsDashboardSystemRow, department string, search string, status string) []alertsDashboardSystemRow {
	filtered := make([]alertsDashboardSystemRow, 0, len(rows))
	for _, row := range rows {
		if department != "" && row.Department != department {
			continue
		}
		if status != "all" && row.Status != status {
			continue
		}
		if !alertsDashboardMatchesSearch(row, search) {
			continue
		}
		filtered = append(filtered, row)
	}
	return filtered
}

func buildAlertsDashboardDepartmentPayload(rows []alertsDashboardDepartmentRow) []gin.H {
	result := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		result = append(result, gin.H{
			"key":          row.Key,
			"name":         row.Name,
			"totalSystems": row.TotalSystems,
			"cleanCount":   row.CleanCount,
			"errorCount":   row.ErrorCount,
			"lastUpdated":  row.LastUpdated,
		})
	}
	return result
}

func buildAlertsDashboardSystemPayload(rows []alertsDashboardSystemRow) []gin.H {
	result := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		result = append(result, gin.H{
			"key":          row.Key,
			"assetId":      row.AssetID,
			"assetTag":     row.AssetTag,
			"hostname":     row.Hostname,
			"username":     row.Username,
			"userEmail":    row.UserEmail,
			"department":   row.Department,
			"module":       row.Module,
			"moduleLabel":  row.ModuleLabel,
			"status":       row.Status,
			"errorCount":   row.ErrorCount,
			"errorDetails": row.ErrorDetails,
			"lastScanAt":   row.LastScanAt,
			"latestAlertId": row.LatestAlert.ID,
			"latestTitle":   row.LatestAlert.Title,
			"latestDetail":  row.LatestAlert.Detail,
		})
	}
	return result
}

func buildAlertsDashboardErrorDetails(records []alertsDashboardRecord, department string) []gin.H {
	result := make([]gin.H, 0)
	for _, record := range records {
		if department != "" && alertsDashboardFirstNonEmpty(record.Department, "Unassigned") != department {
			continue
		}
		if !alertsDashboardIsError(record) {
			continue
		}
		result = append(result, gin.H{
			"id":         record.ID,
			"assetId":    record.AssetID,
			"assetTag":   record.AssetTag,
			"hostname":   alertsDashboardFirstNonEmpty(record.Hostname, record.AssetName, record.AssetTag, record.AssetID),
			"username":   alertsDashboardFirstNonEmpty(record.UserName, record.UserEmail, "Unassigned"),
			"department": alertsDashboardFirstNonEmpty(record.Department, "Unassigned"),
			"severity":   record.Severity,
			"title":      record.Title,
			"detail":     record.Detail,
			"createdAt":  record.CreatedAt,
		})
	}
	if len(result) > 50 {
		return result[:50]
	}
	return result
}

func alertsDashboardFirstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func containsString(items []string, needle string) bool {
	for _, item := range items {
		if item == needle {
			return true
		}
	}
	return false
}