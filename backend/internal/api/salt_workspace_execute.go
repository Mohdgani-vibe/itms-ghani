package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/httpx"
)

type saltWorkspaceExecuteInput struct {
	Client         string   `json:"client"`
	Function       string   `json:"function"`
	Arguments      []string `json:"arguments"`
	TargetMode     string   `json:"targetMode"`
	Target         string   `json:"target"`
	Targets        []string `json:"targets"`
	DepartmentName string   `json:"departmentName"`
	Label          string   `json:"label"`
	Test           bool     `json:"test"`
}

type saltWorkspaceAssetTarget struct {
	ID             string
	AssetTag       string
	Hostname       string
	OSName         string
	DepartmentName string
	SaltMinionID   string
	EntityID       string
}

type parsedSaltWorkspaceResult struct {
	message        string
	updatedItems   []string
	alreadyLatest  []string
	failedPackages []string
	packageChanges []gin.H
	rebootRequired bool
}

func (server *apiServer) executeSaltWorkspaceAction(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	if server.salt == nil || !server.salt.Enabled() {
		httpx.Error(c, http.StatusBadGateway, "saltstack integration is not configured")
		return
	}

	var input saltWorkspaceExecuteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid salt workspace payload")
		return
	}

	clientName := strings.ToLower(strings.TrimSpace(input.Client))
	if clientName == "" {
		clientName = "local"
	}
	if clientName != "local" && clientName != "wheel" && clientName != "runner" {
		httpx.Error(c, http.StatusBadRequest, "unsupported Salt client")
		return
	}

	functionName := strings.ToLower(strings.TrimSpace(input.Function))
	if functionName == "" {
		httpx.Error(c, http.StatusBadRequest, "function is required")
		return
	}

	trimmedArgs := make([]string, 0, len(input.Arguments))
	for _, arg := range input.Arguments {
		trimmed := strings.TrimSpace(arg)
		if trimmed != "" {
			trimmedArgs = append(trimmedArgs, trimmed)
		}
	}
	if policyErr := terminalFunctionPolicy(functionName, trimmedArgs); policyErr != nil {
		httpx.Error(c, http.StatusBadRequest, policyErr.Error())
		return
	}

	requestedAt := time.Now().UTC()
	if clientName != "local" {
		result, err := server.salt.RunLowstate(c.Request.Context(), map[string]any{
			"client": clientName,
			"fun":    functionName,
			"arg":    trimmedArgs,
		})
		if err != nil {
			httpx.Error(c, http.StatusBadGateway, err.Error())
			return
		}
		formatted, _ := json.MarshalIndent(result, "", "  ")
		httpx.JSON(c, http.StatusOK, gin.H{
			"scopeLabel":  firstNonEmpty(strings.TrimSpace(input.Label), strings.ToUpper(clientName)+" workspace"),
			"requestedAt": requestedAt,
			"completedAt": time.Now().UTC(),
			"stdout":      strings.TrimSpace(string(formatted)),
			"raw":         result,
		})
		return
	}

	targets, scopeLabel, err := server.resolveSaltWorkspaceTargets(c, input)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	rows := make([]gin.H, 0, len(targets))
	logs := make([]gin.H, 0, len(targets))
	successCount := 0
	failedCount := 0
	for _, target := range targets {
		row, logEntry := server.executeSaltWorkspaceTarget(c, target, functionName, trimmedArgs, input.Test)
		rows = append(rows, row)
		logs = append(logs, logEntry)
		if rowStatus, _ := row["status"].(string); rowStatus == "success" {
			successCount++
		} else {
			failedCount++
		}
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"scopeLabel":   scopeLabel,
		"requestedAt":  requestedAt,
		"completedAt":  time.Now().UTC(),
		"successCount": successCount,
		"failedCount":  failedCount,
		"rows":         rows,
		"logs":         logs,
	})
}

func (server *apiServer) resolveSaltWorkspaceTargets(c *gin.Context, input saltWorkspaceExecuteInput) ([]saltWorkspaceAssetTarget, string, error) {
	mode := strings.ToLower(strings.TrimSpace(input.TargetMode))
	if mode == "" {
		mode = "single"
	}

	query := `
		SELECT a.id,
			COALESCE(a.asset_tag, ''),
			COALESCE(NULLIF(a.hostname, ''), a.asset_tag),
			COALESCE(cd.os_name, ''),
			COALESCE(d.name, ''),
			COALESCE(a.salt_minion_id, ''),
			a.entity_id::text
		FROM assets a
		LEFT JOIN asset_compute_details cd ON cd.asset_id = a.id
		LEFT JOIN departments d ON d.id = a.dept_id
		WHERE a.is_compute = TRUE`
	args := make([]any, 0)
	filters := make([]string, 0)
	scopeLabel := strings.TrimSpace(input.Label)

	switch mode {
	case "single":
		target := strings.TrimSpace(firstNonEmpty(input.Target, firstNonEmpty(input.Targets...)))
		if target == "" {
			return nil, "", fmt.Errorf("a Salt target is required")
		}
		args = append(args, target)
		filters = append(filters, fmt.Sprintf("(a.hostname = $%d OR a.salt_minion_id = $%d OR a.asset_tag = $%d)", len(args), len(args), len(args)))
		if scopeLabel == "" {
			scopeLabel = target
		}
	case "multiple":
		targets := dedupeNonEmpty(input.Targets)
		if len(targets) == 0 {
			return nil, "", fmt.Errorf("at least one target is required")
		}
		placeholders := make([]string, 0, len(targets))
		for _, target := range targets {
			args = append(args, target)
			placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)))
		}
		joined := strings.Join(placeholders, ", ")
		filters = append(filters, fmt.Sprintf("(a.hostname IN (%s) OR a.salt_minion_id IN (%s) OR a.asset_tag IN (%s))", joined, joined, joined))
		if scopeLabel == "" {
			scopeLabel = fmt.Sprintf("%d selected systems", len(targets))
		}
	case "department":
		departmentName := strings.TrimSpace(input.DepartmentName)
		if departmentName == "" {
			return nil, "", fmt.Errorf("department target requires a department name")
		}
		args = append(args, departmentName)
		filters = append(filters, fmt.Sprintf("COALESCE(d.name, '') = $%d", len(args)))
		if scopeLabel == "" {
			scopeLabel = departmentName
		}
	case "all":
		if scopeLabel == "" {
			scopeLabel = "All systems"
		}
	default:
		return nil, "", fmt.Errorf("unsupported target mode")
	}

	if len(filters) > 0 {
		query += " AND " + strings.Join(filters, " AND ")
	}
	query += " ORDER BY a.asset_tag ASC"

	rows, err := server.db.Query(query, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	items := make([]saltWorkspaceAssetTarget, 0)
	for rows.Next() {
		var item saltWorkspaceAssetTarget
		if err := rows.Scan(&item.ID, &item.AssetTag, &item.Hostname, &item.OSName, &item.DepartmentName, &item.SaltMinionID, &item.EntityID); err != nil {
			return nil, "", err
		}
		if !server.entityAllowedByID(c, item.EntityID) {
			continue
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	if len(items) == 0 {
		return nil, "", fmt.Errorf("no Salt targets matched the requested scope")
	}
	return items, scopeLabel, nil
}

func (server *apiServer) executeSaltWorkspaceTarget(c *gin.Context, target saltWorkspaceAssetTarget, functionName string, args []string, test bool) (gin.H, gin.H) {
	startedAt := time.Now().UTC()
	minionID := strings.TrimSpace(firstNonEmpty(target.SaltMinionID, target.Hostname, target.AssetTag))
	row := gin.H{
		"deviceId":       target.ID,
		"hostname":       target.Hostname,
		"department":     firstNonEmpty(target.DepartmentName, "Unassigned"),
		"osType":         strings.TrimSpace(target.OSName),
		"minionId":       minionID,
		"target":         minionID,
		"action":         functionName,
		"patchStatus":    "running",
		"updatedItems":   []string{},
		"alreadyLatest":  []string{},
		"failedPackages": []string{},
		"packageChanges": []gin.H{},
		"rebootRequired": false,
		"startTime":      startedAt.Format(time.RFC3339),
	}
	logEntry := gin.H{
		"minionId":   minionID,
		"hostname":   target.Hostname,
		"function":   functionName,
		"stateName":  firstNonEmpty(args...),
		"startedAt":  startedAt.Format(time.RFC3339),
		"status":     "running",
		"packages":   []gin.H{},
		"department": firstNonEmpty(target.DepartmentName, "Unassigned"),
	}

	connected, err := server.salt.TargetConnected(c.Request.Context(), minionID)
	if err != nil || !connected {
		errText := "salt minion is not connected to the master"
		if err != nil {
			errText = err.Error()
		}
		return finalizeSaltWorkspaceTarget(row, logEntry, startedAt, "no_response", errText, nil)
	}

	var result any
	switch functionName {
	case "state", "state.apply", "state.sls":
		result, err = server.salt.RunNamedStateWithOptions(c.Request.Context(), minionID, functionName, args[0], test)
	case "cmd.run", "cmd.run_all", "cmd.script":
		result, err = server.salt.RunCommand(c.Request.Context(), minionID, strings.Join(args, " "))
	default:
		result, err = server.salt.RunLowstate(c.Request.Context(), map[string]any{
			"client":    "local",
			"tgt":       minionID,
			"expr_form": server.config.SaltTargetType,
			"fun":       functionName,
			"arg":       args,
		})
	}
	if err != nil {
		return finalizeSaltWorkspaceTarget(row, logEntry, startedAt, "failed", err.Error(), result)
	}

	status, parsed := parseSaltWorkspaceResult(functionName, args, result)
	row["status"] = status
	row["patchStatus"] = status
	row["message"] = parsed.message
	row["updatedItems"] = parsed.updatedItems
	row["alreadyLatest"] = parsed.alreadyLatest
	row["failedPackages"] = parsed.failedPackages
	row["packageChanges"] = parsed.packageChanges
	row["rebootRequired"] = parsed.rebootRequired
	row["durationSeconds"] = time.Since(startedAt).Seconds()
	row["rawResult"] = result

	logEntry["status"] = status
	logEntry["packages"] = parsed.packageChanges
	logEntry["message"] = parsed.message
	logEntry["durationMs"] = time.Since(startedAt).Milliseconds()
	logEntry["rawResult"] = result
	return row, logEntry
}

func finalizeSaltWorkspaceTarget(row gin.H, logEntry gin.H, startedAt time.Time, status string, errText string, result any) (gin.H, gin.H) {
	row["status"] = status
	row["patchStatus"] = status
	row["message"] = errText
	row["error"] = errText
	row["durationSeconds"] = time.Since(startedAt).Seconds()
	row["rawResult"] = result
	logEntry["status"] = status
	logEntry["error"] = errText
	logEntry["durationMs"] = time.Since(startedAt).Milliseconds()
	logEntry["rawResult"] = result
	return row, logEntry
}

func parseSaltWorkspaceResult(functionName string, args []string, result any) (string, parsedSaltWorkspaceResult) {
	parsed := parsedSaltWorkspaceResult{
		message:        firstNonEmpty(strings.TrimSpace(firstNonEmpty(args...)), functionName),
		updatedItems:   []string{},
		alreadyLatest:  []string{},
		failedPackages: []string{},
		packageChanges: []gin.H{},
	}

	resultMap, ok := result.(map[string]any)
	if ok {
		if retcode, exists := resultMap["retcode"]; exists {
			if saltRetcodeValue(retcode) != 0 {
				parsed.message = firstNonEmpty(strings.TrimSpace(fmt.Sprint(resultMap["stderr"])), "Salt command failed")
				return "failed", parsed
			}
			stdout := strings.TrimSpace(fmt.Sprint(resultMap["stdout"]))
			if stdout != "" && stdout != "<nil>" {
				parsed.message = stdout
			}
			return "success", parsed
		}

		packageChanges, updatedItems, alreadyLatest, failedPackages := collectSaltStatePackageDetails(resultMap)
		if len(packageChanges) > 0 || len(updatedItems) > 0 || len(alreadyLatest) > 0 || len(failedPackages) > 0 {
			parsed.packageChanges = packageChanges
			parsed.updatedItems = updatedItems
			parsed.alreadyLatest = alreadyLatest
			parsed.failedPackages = failedPackages
			parsed.rebootRequired = detectSaltRebootRequired(resultMap)
			if len(updatedItems) > 0 {
				parsed.message = fmt.Sprintf("Updated %d package(s)", len(updatedItems))
			} else if len(alreadyLatest) > 0 {
				parsed.message = fmt.Sprintf("Already latest: %s", strings.Join(alreadyLatest, ", "))
			}
			if len(failedPackages) > 0 {
				return "failed", parsed
			}
			return "success", parsed
		}

		formatted, _ := json.MarshalIndent(resultMap, "", "  ")
		if len(formatted) > 0 {
			parsed.message = strings.TrimSpace(string(formatted))
		}
	}

	return "success", parsed
}

func collectSaltStatePackageDetails(result map[string]any) ([]gin.H, []string, []string, []string) {
	changeMap := map[string]gin.H{}
	updated := map[string]struct{}{}
	alreadyLatest := map[string]struct{}{}
	failed := map[string]struct{}{}
	collectStateMap := func(stateMap map[string]any) {
		for _, stateValue := range stateMap {
			stateRecord, ok := stateValue.(map[string]any)
			if !ok {
				continue
			}
			stateResult, hasResult := stateRecord["result"].(bool)
			comment := strings.TrimSpace(fmt.Sprint(stateRecord["comment"]))
			if hasResult && !stateResult {
				if pkgName := strings.TrimSpace(fmt.Sprint(stateRecord["name"])); pkgName != "" {
					failed[pkgName] = struct{}{}
				}
				if comment != "" && comment != "<nil>" {
					failed[comment] = struct{}{}
				}
				continue
			}

			changes, ok := stateRecord["changes"].(map[string]any)
			if !ok || len(changes) == 0 {
				if comment != "" && strings.Contains(strings.ToLower(comment), "up-to-date") {
					if pkgName := strings.TrimSpace(fmt.Sprint(stateRecord["name"])); pkgName != "" {
						alreadyLatest[pkgName] = struct{}{}
					}
				}
				continue
			}

			for pkgName, rawChange := range changes {
				changeRecord, ok := rawChange.(map[string]any)
				if !ok {
					updated[pkgName] = struct{}{}
					continue
				}
				oldVersion := nullableVersion(changeRecord["old"])
				newVersion := nullableVersion(changeRecord["new"])
				if oldVersion == "" && newVersion == "" {
					for nestedPkgName, nestedValue := range changeRecord {
						nestedMap, ok := nestedValue.(map[string]any)
						if !ok {
							continue
						}
						oldVersion = nullableVersion(nestedMap["old"])
						newVersion = nullableVersion(nestedMap["new"])
						pkgName = nestedPkgName
						break
					}
				}
				changeMap[pkgName+"::"+oldVersion+"::"+newVersion] = gin.H{"name": pkgName, "fromVersion": nilIfEmpty(oldVersion), "toVersion": nilIfEmpty(newVersion)}
				updated[pkgName] = struct{}{}
			}
		}
	}

	if returns, ok := result["return"].([]any); ok {
		for _, item := range returns {
			entry, ok := item.(map[string]any)
			if !ok {
				continue
			}
			for _, rawValue := range entry {
				stateMap, ok := rawValue.(map[string]any)
				if !ok {
					continue
				}
				collectStateMap(stateMap)
			}
		}
	} else {
		for _, rawValue := range result {
			stateMap, ok := rawValue.(map[string]any)
			if !ok {
				continue
			}
			collectStateMap(stateMap)
		}
	}

	packageChanges := make([]gin.H, 0, len(changeMap))
	for _, value := range changeMap {
		packageChanges = append(packageChanges, value)
	}
	sort.Slice(packageChanges, func(i, j int) bool {
		return fmt.Sprint(packageChanges[i]["name"]) < fmt.Sprint(packageChanges[j]["name"])
	})

	return packageChanges, mapKeys(updated), mapKeys(alreadyLatest), mapKeys(failed)
}

func detectSaltRebootRequired(result map[string]any) bool {
	serialized, err := json.Marshal(result)
	if err != nil {
		return false
	}
	haystack := strings.ToLower(string(serialized))
	return strings.Contains(haystack, "reboot") && strings.Contains(haystack, "require")
}

func saltRetcodeValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil {
			return parsed
		}
	}
	return 0
}

func nullableVersion(value any) string {
	text := strings.TrimSpace(fmt.Sprint(value))
	if text == "" || text == "<nil>" || text == "map[]" {
		return ""
	}
	return text
}

func nilIfEmpty(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func mapKeys(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for key := range values {
		if strings.TrimSpace(key) != "" {
			result = append(result, key)
		}
	}
	sort.Strings(result)
	return result
}

func dedupeNonEmpty(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
