package api

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"itms/backend/internal/app"
	"itms/backend/internal/chatbridge"
	"itms/backend/internal/integrations/saltstack"
	"itms/backend/internal/integrations/wazuh"
	"itms/backend/internal/inventorysync"
	"itms/backend/internal/platform/authn"
	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
	"itms/backend/pkg/mattermost"
)

var hostnamePattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

const (
	maxInventoryIngestBytes  int64 = 8 << 20
	maxInventoryIngestAssets       = 5000
)

var terminalAllowedCommands = map[string]struct{}{
	"cat":        {},
	"date":       {},
	"df":         {},
	"dmesg":      {},
	"dpkg":       {},
	"du":         {},
	"env":        {},
	"find":       {},
	"free":       {},
	"grep":       {},
	"head":       {},
	"hostname":   {},
	"id":         {},
	"ifconfig":   {},
	"ip":         {},
	"journalctl": {},
	"last":       {},
	"ls":         {},
	"lscpu":      {},
	"lsblk":      {},
	"mount":      {},
	"netstat":    {},
	"printenv":   {},
	"ps":         {},
	"pwd":        {},
	"rpm":        {},
	"ss":         {},
	"systemctl":  {},
	"tail":       {},
	"uname":      {},
	"uptime":     {},
	"whoami":     {},
}

var terminalBlockedFragments = []string{"&&", "||", ";", "|", ">", "<", "`", "$(", "${", "sudo ", " su ", " ssh ", "scp ", "sftp ", "rm ", "mkfs", "shutdown", "reboot", "poweroff", "passwd", "useradd", "usermod", "groupadd", "chmod ", "chown ", "tee ", "curl ", "wget ", "nc ", "ncat ", "python ", "python3 ", "perl ", "ruby ", "bash ", "sh ", "zsh ", "fish ", "vi ", "vim ", "nano ", " top ", " htop ", " less ", " more "}

var terminalPresetCommands = []string{"hostname", "uptime", "df -h", "free -h", "ps aux", "systemctl status wazuh-agent", "journalctl -n 100", "ip addr"}
var terminalAllowedFunctions = []string{"cmd.run", "cmd.script", "disk.usage", "grains.items", "network.interfaces", "pkg.uptodate", "pkg.upgrades", "service.status", "state.apply", "state.sls", "status.uptime", "test.ping", "test.version"}

var terminalPresetGroups = []gin.H{
	{"label": "System", "commands": []string{"hostname", "uptime"}},
	{"label": "Storage", "commands": []string{"df -h", "free -h"}},
	{"label": "Processes", "commands": []string{"ps aux"}},
	{"label": "Salt States", "commands": []string{"state.apply patch.run"}},
	{"label": "Services", "commands": []string{"systemctl status wazuh-agent", "journalctl -n 100"}},
	{"label": "Network", "commands": []string{"ip addr"}},
}

var terminalBlockedExamples = []string{"rm -rf /tmp/workspace", "tail -f /var/log/syslog", "systemctl restart wazuh-agent", "sudo cat /etc/shadow", "curl https://example.com/script.sh", "ps aux | grep salt"}
var terminalStatePattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)
var terminalSimpleArgumentPattern = regexp.MustCompile(`^[a-zA-Z0-9._@:/-]+$`)

type terminalCommandMode string

const (
	terminalCommandModeShell terminalCommandMode = "shell"
	terminalCommandModeState terminalCommandMode = "state"
)

var userImportCSVHeaders = []string{"Username", "Email id", "Employee id", "department", "password", "role", "entity_code", "location", "is_active"}

// Inventory item CSV headers
var inventoryItemCSVHeaders = []string{"Item Code", "Category", "Name", "Asset Tag", "Serial Number", "Specs", "Branch ID", "Assigned User ID", "Warranty Expires At", "Cost", "Status"}

// --- Inventory Item CSV Import/Export ---
func (server *apiServer) exportInventoryItemsCSV(c *gin.Context) {
   if !server.requireRoles(c, "super_admin", "it_team") {
	   return
   }
   // Search/filter support for asset_tag and cost
   search := c.Query("search")
   var rows *sql.Rows
   var err error
	if search != "" {
		like := "%" + search + "%"
		rows, err = server.db.Query(`SELECT item_code, category, name, COALESCE(asset_tag, ''), COALESCE(serial_number, ''), COALESCE(specs, ''), COALESCE(branch_id::text, ''), COALESCE(assigned_user_id::text, ''), COALESCE(warranty_expires_at::text, ''), COALESCE(cost::text, ''), status FROM stock_items WHERE item_code ILIKE $1 OR category ILIKE $1 OR COALESCE(asset_tag, '') ILIKE $1 OR name ILIKE $1 OR COALESCE(serial_number, '') ILIKE $1 OR COALESCE(specs, '') ILIKE $1 OR COALESCE(cost::text, '') ILIKE $1 ORDER BY item_code`, like)
	} else {
		rows, err = server.db.Query(`SELECT item_code, category, name, COALESCE(asset_tag, ''), COALESCE(serial_number, ''), COALESCE(specs, ''), COALESCE(branch_id::text, ''), COALESCE(assigned_user_id::text, ''), COALESCE(warranty_expires_at::text, ''), COALESCE(cost::text, ''), status FROM stock_items ORDER BY item_code`)
	}
   if err != nil {
	   httpx.Error(c, http.StatusInternalServerError, err.Error())
	   return
   }
   defer rows.Close()
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=inventory-items-export.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write(inventoryItemCSVHeaders)
	for rows.Next() {
		var record [11]string
		if err := rows.Scan(&record[0], &record[1], &record[2], &record[3], &record[4], &record[5], &record[6], &record[7], &record[8], &record[9], &record[10]); err != nil {
		   httpx.Error(c, http.StatusInternalServerError, err.Error())
		   return
	   }
	   _ = writer.Write(record[:])
   }
   if err := rows.Err(); err != nil {
	   httpx.Error(c, http.StatusInternalServerError, err.Error())
	   return
   }
   writer.Flush()
}

func (server *apiServer) exportInventoryItemImportTemplate(c *gin.Context) {
   if !server.requireRoles(c, "super_admin", "it_team") {
	   return
   }
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=inventory-items-import-template.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write(inventoryItemCSVHeaders)
	_ = writer.Write([]string{"ITEM001", "Laptop", "Laptop", "ASSET001", "SN123456", "i5/8GB/256GB", "BRANCH01", "", "2027-01-01", "50000", "inventory"})
	writer.Flush()
}

func (server *apiServer) importInventoryItemsCSV(c *gin.Context) {
   if !server.requireRoles(c, "super_admin", "it_team") {
	   return
   }
   fileHeader, err := c.FormFile("file")
   if err != nil {
	   httpx.Error(c, http.StatusBadRequest, "csv file is required")
	   return
   }
   file, err := fileHeader.Open()
   if err != nil {
	   httpx.Error(c, http.StatusBadRequest, "failed to open uploaded csv")
	   return
   }
   defer file.Close()
   reader := csv.NewReader(file)
   reader.FieldsPerRecord = -1
   records, err := reader.ReadAll()
   if err != nil {
	   httpx.Error(c, http.StatusBadRequest, "invalid csv file")
	   return
   }
   if len(records) == 0 {
	   httpx.Error(c, http.StatusBadRequest, "csv file is empty")
	   return
   }
   headers := map[int]string{}
   availableHeaders := map[string]int{}
   for idx, header := range records[0] {
	   normalized := normalizeCSVHeader(header)
	   headers[idx] = normalized
	   availableHeaders[normalized] = idx
   }
	required := []string{"item_code", "category", "name", "asset_tag", "serial_number", "branch_id"}
   for _, req := range required {
	   if _, ok := availableHeaders[req]; !ok {
		   httpx.Error(c, http.StatusBadRequest, "csv must include "+req+" column")
		   return
	   }
   }
   seenAssetTags := map[string]struct{}{}
   seenSerialNumbers := map[string]struct{}{}
   rowErrors := make([]gin.H, 0)
   createdCount := 0
   updatedCount := 0
   for rowIndex, record := range records[1:] {
	   csvRowNumber := rowIndex + 2
	   row := map[string]string{}
	   empty := true
	   for idx, value := range record {
		   header, ok := headers[idx]
		   if !ok || header == "" {
			   continue
		   }
		   trimmed := strings.TrimSpace(value)
		   if trimmed != "" {
			   empty = false
		   }
		   row[header] = trimmed
	   }
	   if empty {
		   continue
	   }
		itemCode := row["item_code"]
		category := row["category"]
	   name := row["name"]
	   assetTag := row["asset_tag"]
	   serialNumber := row["serial_number"]
	   branchID := row["branch_id"]
	   status := row["status"]
	   specs := row["specs"]
	   assignedUserID := row["assigned_user_id"]
	   warrantyExpiresAt := row["warranty_expires_at"]
	   cost := row["cost"]

	   // Validation
		if itemCode == "" {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "item_code is required"})
			continue
		}
	   if category == "" {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "category is required"})
		   continue
	   }
	   if name == "" {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "name is required"})
		   continue
	   }
	   if assetTag == "" {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "asset_tag is required"})
		   continue
	   }
	   if serialNumber == "" {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "serial_number is required"})
		   continue
	   }
	   if branchID == "" {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "branch_id is required"})
		   continue
	   }
	   // Uniqueness in file
	   if _, exists := seenAssetTags[assetTag]; exists {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "duplicate asset_tag in file"})
		   continue
	   }
	   seenAssetTags[assetTag] = struct{}{}
	   if _, exists := seenSerialNumbers[serialNumber]; exists {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "duplicate serial_number in file"})
		   continue
	   }
	   seenSerialNumbers[serialNumber] = struct{}{}
	   // Warranty date format
	   if warrantyExpiresAt != "" {
		   validDate := false
		   if _, err := time.Parse("2006-01-02", warrantyExpiresAt); err == nil {
			   validDate = true
		   } else if _, err := time.Parse("02/01/2006", warrantyExpiresAt); err == nil {
			   validDate = true
		   }
		   if !validDate {
			   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "invalid warranty_expires_at format (use DD/MM/YYYY or YYYY-MM-DD)"})
			   continue
		   }
	   }
	   // Cost numeric
	   if cost != "" {
		   if _, err := strconv.ParseFloat(cost, 64); err != nil {
			   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "invalid cost format"})
			   continue
		   }
	   }
	   // Uniqueness in DB
	var count int
	err := server.db.QueryRow(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`, assetTag, serialNumber).Scan(&count)
	   if err == nil && count > 0 {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "asset_tag or serial_number already exists in database"})
		   continue
	   }
	   // Upsert logic: try update, else insert
	res, err := server.db.Exec(`UPDATE stock_items SET category = $2, name = $3, asset_tag = $4, serial_number = NULLIF($5, ''), specs = NULLIF($6, ''), branch_id = NULLIF($7, '')::uuid, assigned_user_id = NULLIF($8, '')::uuid, warranty_expires_at = NULLIF($9, '')::date, cost = NULLIF($10, '')::numeric(12,2), status = COALESCE(NULLIF($11, ''), status), updated_at = NOW() WHERE item_code = $1`, itemCode, category, name, assetTag, serialNumber, specs, branchID, assignedUserID, warrantyExpiresAt, cost, status)
	   if err != nil {
		   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
		   continue
	   }
	   affected, _ := res.RowsAffected()
	   if affected == 0 {
		   // Insert
		_, err := server.db.Exec(`INSERT INTO stock_items (item_code, category, name, asset_tag, serial_number, specs, branch_id, assigned_user_id, warranty_expires_at, cost, status, created_at) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, '')::uuid, NULLIF($8, '')::uuid, NULLIF($9, '')::date, NULLIF($10, '')::numeric(12,2), COALESCE(NULLIF($11, ''), 'inventory'), NOW())`, itemCode, category, name, assetTag, serialNumber, specs, branchID, assignedUserID, warrantyExpiresAt, cost, status)
		   if err != nil {
			   rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			   continue
		   }
		   createdCount++
	   } else {
		   updatedCount++
	   }
   }
	httpx.JSON(c, http.StatusOK, gin.H{"created": createdCount, "updated": updatedCount, "errors": rowErrors, "headers": inventoryItemCSVHeaders})
}

func terminalCommandPolicy(command string) error {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return fmt.Errorf("command is required")
	}
	if strings.ContainsAny(trimmed, "\r\n") {
		return fmt.Errorf("command must be a single line")
	}
	lowerCommand := strings.ToLower(" " + trimmed + " ")
	for _, fragment := range terminalBlockedFragments {
		if strings.Contains(lowerCommand, fragment) {
			return fmt.Errorf("command contains a blocked shell pattern")
		}
	}
	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return fmt.Errorf("command is required")
	}
	rootCommand := strings.ToLower(strings.TrimSpace(fields[0]))
	if _, ok := terminalAllowedCommands[rootCommand]; !ok {
		return fmt.Errorf("command is not allowed in the terminal console")
	}
	if rootCommand == "systemctl" && len(fields) > 1 {
		subcommand := strings.ToLower(strings.TrimSpace(fields[1]))
		if subcommand != "status" && subcommand != "show" && subcommand != "list-units" && subcommand != "list-unit-files" {
			return fmt.Errorf("only read-only systemctl commands are allowed")
		}
	}
	if rootCommand == "journalctl" && len(fields) > 1 {
		for _, field := range fields[1:] {
			if strings.HasPrefix(field, "--vacuum") || strings.EqualFold(field, "--setup-keys") || strings.EqualFold(field, "--rotate") {
				return fmt.Errorf("only read-only journalctl commands are allowed")
			}
		}
	}
	return nil
}

func normalizeTerminalCommand(command string) (string, error) {
	_, normalized, err := parseTerminalCommand(command)
	if err != nil {
		return "", err
	}
	return normalized, nil
}

func parseTerminalCommand(command string) (terminalCommandMode, string, error) {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return terminalCommandModeShell, "", fmt.Errorf("command is required")
	}
	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return terminalCommandModeShell, "", fmt.Errorf("command is required")
	}
	switch strings.ToLower(strings.TrimSpace(fields[0])) {
	case "cmd.run", "cmd.run_all":
		normalized := strings.TrimSpace(trimmed[len(fields[0]):])
		if normalized == "" {
			return terminalCommandModeShell, "", fmt.Errorf("command is required")
		}
		if unquoted, err := strconv.Unquote(normalized); err == nil {
			normalized = strings.TrimSpace(unquoted)
		} else if len(normalized) >= 2 && normalized[0] == '\'' && normalized[len(normalized)-1] == '\'' {
			normalized = strings.TrimSpace(normalized[1 : len(normalized)-1])
		}
		if normalized == "" {
			return terminalCommandModeShell, "", fmt.Errorf("command is required")
		}
		return terminalCommandModeShell, normalized, nil
	case "state", "state.apply", "state.sls":
		stateName := strings.TrimSpace(strings.Join(fields[1:], " "))
		if stateName == "" {
			return terminalCommandModeState, "", fmt.Errorf("state is required")
		}
		return terminalCommandModeState, stateName, nil
	default:
		return terminalCommandModeShell, trimmed, nil
	}
}

func terminalStatePolicy(stateName string) error {
	trimmed := strings.TrimSpace(stateName)
	if trimmed == "" {
		return fmt.Errorf("state is required")
	}
	if !terminalStatePattern.MatchString(trimmed) {
		return fmt.Errorf("only simple Salt state names are allowed in the terminal console")
	}
	return nil
}

func terminalPolicyPayload() gin.H {
	allowedCommands := make([]string, 0, len(terminalAllowedCommands))
	for command := range terminalAllowedCommands {
		allowedCommands = append(allowedCommands, command)
	}
	sort.Strings(allowedCommands)
	allowedFunctions := append([]string(nil), terminalAllowedFunctions...)
	sort.Strings(allowedFunctions)
	return gin.H{
		"allowedCommands": allowedCommands,
		"allowedFunctions": allowedFunctions,
		"presetCommands":  terminalPresetCommands,
		"presetGroups":    terminalPresetGroups,
		"blockedExamples": terminalBlockedExamples,
		"restrictions": []string{
			"Only approved read-only diagnostic commands are allowed.",
			"Salt state runs are allowed only as state.apply <state_name> or state <state_name>.",
			"Shell chaining, pipes, redirection, and subshell expressions are blocked.",
			"Privilege escalation, remote access, download tools, and interpreter launches are blocked.",
			"Interactive editors and long-running terminal UIs are blocked.",
			"Only read-only systemctl and journalctl usage is allowed.",
		},
	}
}

func terminalFunctionPolicy(functionName string, args []string) error {
	normalizedFunction := strings.ToLower(strings.TrimSpace(functionName))
	trimmedArgs := make([]string, 0, len(args))
	for _, arg := range args {
		trimmed := strings.TrimSpace(arg)
		if trimmed != "" {
			trimmedArgs = append(trimmedArgs, trimmed)
		}
	}

	switch normalizedFunction {
	case "test.ping", "test.version", "grains.items", "disk.usage", "status.uptime", "pkg.upgrades", "pkg.uptodate", "network.interfaces":
		if len(trimmedArgs) > 0 {
			return fmt.Errorf("%s does not accept arguments in the terminal function runner", normalizedFunction)
		}
		return nil
	case "service.status":
		if len(trimmedArgs) != 1 {
			return fmt.Errorf("service.status requires exactly one service name")
		}
		if !terminalSimpleArgumentPattern.MatchString(trimmedArgs[0]) {
			return fmt.Errorf("invalid service name")
		}
		return nil
	case "state", "state.apply", "state.sls", "cmd.script":
		// DANGEROUS FUNCTIONS - Blocked for all users in terminal
		// These powerful commands can modify system state, run arbitrary scripts
		return fmt.Errorf("function %s is restricted - requires super_admin role and workspace execution", normalizedFunction)
	case "cmd.run", "cmd.run_all":
		if len(trimmedArgs) == 0 {
			return fmt.Errorf("%s requires a command", normalizedFunction)
		}
		return terminalCommandPolicy(strings.Join(trimmedArgs, " "))
	default:
		return fmt.Errorf("function is not allowed in the terminal function runner")
	}
}

// terminalFunctionPolicyWithRole validates Salt function with role-based restrictions
// Used by workspace execution for role-aware policy
func terminalFunctionPolicyWithRole(functionName string, args []string, role string) error {
	normalizedFunction := strings.ToLower(strings.TrimSpace(functionName))
	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	
	trimmedArgs := make([]string, 0, len(args))
	for _, arg := range args {
		trimmed := strings.TrimSpace(arg)
		if trimmed != "" {
			trimmedArgs = append(trimmedArgs, trimmed)
		}
	}

	// Dangerous functions require super_admin role
	dangerousFunctions := []string{"state", "state.apply", "state.sls", "cmd.script"}
	for _, dangerous := range dangerousFunctions {
		if normalizedFunction == dangerous {
			if normalizedRole != "super_admin" {
				return fmt.Errorf("function %s requires super_admin role", normalizedFunction)
			}
			// super_admin can proceed with validation
			break
		}
	}

	switch normalizedFunction {
	case "test.ping", "test.version", "grains.items", "disk.usage", "status.uptime", "pkg.upgrades", "pkg.uptodate", "network.interfaces":
		if len(trimmedArgs) > 0 {
			return fmt.Errorf("%s does not accept arguments in the terminal function runner", normalizedFunction)
		}
		return nil
	case "service.status":
		if len(trimmedArgs) != 1 {
			return fmt.Errorf("service.status requires exactly one service name")
		}
		if !terminalSimpleArgumentPattern.MatchString(trimmedArgs[0]) {
			return fmt.Errorf("invalid service name")
		}
		return nil
	case "state", "state.apply", "state.sls":
		if len(trimmedArgs) != 1 {
			return fmt.Errorf("%s requires exactly one state name", normalizedFunction)
		}
		return terminalStatePolicy(trimmedArgs[0])
	case "cmd.run", "cmd.run_all", "cmd.script":
		if len(trimmedArgs) == 0 {
			return fmt.Errorf("%s requires a command", normalizedFunction)
		}
		return terminalCommandPolicy(strings.Join(trimmedArgs, " "))
	default:
		return fmt.Errorf("function is not allowed in the terminal function runner")
	}
}

func isSyntheticTestIdentity(fullName string, email string, employeeCode string) bool {
	haystack := strings.ToLower(strings.Join([]string{fullName, email, employeeCode}, " "))
	return strings.Contains(haystack, "probe") || strings.Contains(haystack, "smoke")
}

func fallbackFullNameFromEmail(email string) string {
	localPart := strings.TrimSpace(email)
	if at := strings.Index(localPart, "@"); at >= 0 {
		localPart = localPart[:at]
	}
	localPart = strings.Trim(localPart, " ._-")
	if localPart == "" {
		return "New Employee"
	}
	parts := strings.FieldsFunc(localPart, func(r rune) bool {
		switch r {
		case '.', '_', '-', ' ':
			return true
		default:
			return false
		}
	})
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + strings.ToLower(part[1:])
	}
	name := strings.TrimSpace(strings.Join(parts, " "))
	if name == "" {
		return "New Employee"
	}
	return name
}

type compatDeviceRecord struct {
	ID              string
	AssetID         string
	Hostname        string
	DeviceType      string
	OSName          string
	GPU             string
	MACAddress      string
	LastSeenAt      string
	Status          string
	PatchStatus     string
	AlertStatus     string
	ComplianceScore int
	SerialNumber    string
	Model           string
	Cost            string
	WarrantyUntil   string
	UserID          string
	UserFullName    string
	UserEmail       string
	UserEmpID       string
	DepartmentName  string
	BranchName      string
	AssignedTo      string
	EntityID        string
	HasWPS          bool
	HasLibreOffice  bool
	HasChrome       bool
	HasSalt         bool
}

type apiServer struct {
	db            *sql.DB
	config        app.Config
	auth          *authn.Manager
	googleSSO     *authn.GoogleSSO
	salt          *saltstack.Client
	wazuh         *wazuh.Client
	mattermost    *mattermost.Client
	chatBridge    *chatbridge.Service
	chat          *chatHub
	announcements *announcementHub
	sync          *inventorysync.Service
	authLimiter   *authAttemptLimiter
}

type authAttemptLimiter struct {
	mu            sync.Mutex
	entries       map[string]authAttemptEntry
	window        time.Duration
	maxFailures   int
	blockDuration time.Duration
}

type authAttemptEntry struct {
	failures     []time.Time
	blockedUntil time.Time
}

type assetScriptDefinition struct {
	State       string
	FollowUp    []string
	Component   string
	Integration string
}

type assetPatchDefinition struct {
	Action      string
	State       string
	Command     string
	Component   string
	Integration string
}

type userContext struct {
	ID         string   `json:"id"`
	EmpID      string   `json:"emp_id"`
	FullName   string   `json:"full_name"`
	Email      string   `json:"email"`
	Role       string   `json:"role"`
	EntityID   string   `json:"entity_id"`
	DeptID     string   `json:"dept_id,omitempty"`
	LocationID string   `json:"location_id,omitempty"`
	Portals    []string `json:"portals"`
}

type authResponse struct {
	Token string      `json:"token"`
	User  interface{} `json:"user"`
}

type paginatedResponse struct {
	Items    interface{} `json:"items"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

type namedCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

func auditModuleForTargetType(targetType string) string {
	switch strings.TrimSpace(strings.ToLower(targetType)) {
	case "user":
		return "access"
	case "device", "stock_item", "patch_job", "asset":
		return "assets"
	case "gatepass":
		return "gatepass"
	case "chat_channel":
		return "chat"
	case "terminal_session":
		return "terminal"
	case "request":
		return "requests"
	case "announcement":
		return "announcements"
	case "alert":
		return "alerts"
	case "setting":
		return "settings"
	default:
		return "all"
	}
}

func auditSummaryForAction(action string, targetType string, detail any) string {
	action = strings.TrimSpace(strings.ToLower(action))
	targetType = strings.TrimSpace(strings.ToLower(targetType))

	if targetType == "user" {
		detailMap, _ := detail.(map[string]any)
		switch action {
		case "user_added":
			return "User account created"
		case "user_deactivated":
			return "User account deactivated"
		case "user_updated":
			if detailMap != nil {
				if passwordReset, ok := detailMap["password_reset"].(bool); ok && passwordReset {
					return "User password reset"
				}
				if isActive, ok := detailMap["is_active"].(bool); ok {
					if isActive {
						return "User account reactivated"
					}
					return "User account status changed to inactive"
				}
				if roleName, ok := detailMap["role"].(string); ok && strings.TrimSpace(roleName) != "" {
					return fmt.Sprintf("User access updated to %s", strings.ReplaceAll(strings.TrimSpace(roleName), "_", " "))
				}
				if entityID, ok := detailMap["entity_id"].(string); ok && strings.TrimSpace(entityID) != "" {
					if deptID, deptOK := detailMap["dept_id"].(string); deptOK && strings.TrimSpace(deptID) != "" {
						return "User profile and department updated"
					}
					if locationID, locationOK := detailMap["location_id"].(string); locationOK && strings.TrimSpace(locationID) != "" {
						return "User profile and branch updated"
					}
				}
			}
			return "User profile updated"
		case "profile_updated":
			return "Own user profile updated"
		case "user_import":
			return "User CSV import completed"
		case "user_imported":
			return "User imported from CSV"
		}
	}

	return fmt.Sprintf("%s %s", strings.ReplaceAll(action, "_", " "), strings.TrimSpace(targetType))
}

func parsePaginationRequest(c *gin.Context, defaultPageSize int) (page int, pageSize int, enabled bool) {
	enabled = c.Query("paginate") != "" || c.Query("page") != "" || c.Query("page_size") != ""
	page = 1
	pageSize = defaultPageSize

	if value := strings.TrimSpace(c.Query("page")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			page = parsed
		}
	}

	if value := strings.TrimSpace(c.Query("page_size")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}

	if pageSize > 200 {
		pageSize = 200
	}

	return page, pageSize, enabled
}

func parseCommaSeparatedValues(raw string) []string {
	items := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == '\t'
	})
	values := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		values = append(values, value)
	}
	return values
}

func paginationBounds(total int, page int, pageSize int) (start int, end int) {
	if total <= 0 {
		return 0, 0
	}
	start = (page - 1) * pageSize
	if start >= total {
		start = 0
	}
	end = start + pageSize
	if end > total {
		end = total
	}
	return start, end
}

func NewRouter(db *sql.DB, config app.Config, syncService *inventorysync.Service) *gin.Engine {
	server := &apiServer{
		db:            db,
		config:        config,
		auth:          authn.NewManager(config.JWTSecret, config.JWTTTL),
		googleSSO:     authn.NewGoogleSSO(config.GoogleClientID, config.GoogleClientSecret, config.GoogleRedirectURL, config.GoogleHostedDomain),
		salt:          saltstack.NewClient(config.SaltAPIBaseURL, config.SaltAPIToken, config.SaltAPIUsername, config.SaltAPIPassword, config.SaltAPIEAuth, config.SaltTargetType),
		wazuh:         wazuh.NewClient(config.WazuhAPIBaseURL, config.WazuhAPIUsername, config.WazuhAPIPassword, config.WazuhAPICAFile, config.WazuhAPIInsecureSkipVerify),
		mattermost:    mattermost.NewClient(config.MattermostBaseURL, config.MattermostToken),
		chat:          newChatHub(),
		announcements: newAnnouncementHub(),
		sync:          syncService,
		authLimiter:   newAuthAttemptLimiter(10*time.Minute, 5, 30*time.Minute), // 5 attempts, 30min block
	}
	server.chatBridge = chatbridge.NewService(db, server.mattermost, config)

	router := gin.New()
	router.Use(
		gin.Logger(),
		gin.Recovery(),
		middleware.SecurityHeaders(),
		middleware.CORS(config.FrontendOrigin),
		middleware.CSRFProtection(),
		middleware.RequestSizeLimit(10<<20), // 10MB max request size
		middleware.SuspiciousPatternDetection(),
		middleware.Audit(db),
	)
	router.GET("/ws/chat", server.chatWebsocket)
	router.GET("/ws/announcements", server.announcementWebsocket)
	router.GET("/ws/ssh/assets/:id", server.assetSSHWebsocket)
	router.GET("/installers/install-itms-agent.ps1", server.downloadInstallerScript("install-itms-agent.ps1", "text/plain; charset=utf-8"))
	router.GET("/installers/install-itms-agent.sh", server.downloadInstallerScript("install-itms-agent.sh", "text/plain; charset=utf-8"))
	router.GET("/installers/push-system-inventory.ps1", server.downloadInstallerScript("push-system-inventory.ps1", "text/plain; charset=utf-8"))
	router.GET("/installers/push-system-inventory.py", server.downloadInstallerScript("push-system-inventory.py", "text/x-python; charset=utf-8"))

	api := router.Group("/api")
	{
		api.GET("/health", server.healthCheck)
		api.POST("/inventory-sync/ingest", server.ingestInventorySnapshot)
		api.POST("/backup/ingest", server.ingestBackupStatus)
		api.PUT("/assets/heartbeat", server.heartbeat)
		server.registerAuthRoutes(api)
		
		// Apply rate limiting to sensitive API endpoints
		api.Use(middleware.RateLimit(false)) // 60 req/min for general API

		protected := api.Group("")
		protected.Use(middleware.AuthRequired(server.auth))
		{
			protected.GET("/entities", server.listEntities)
					   // protected.POST("/entities", server.createEntity)
			protected.PATCH("/entities/:id", server.updateEntity)

			protected.GET("/locations", server.listLocations)
			protected.POST("/locations", server.createLocation)
			protected.PATCH("/locations/:id", server.updateLocation)

			protected.GET("/departments", server.listDepartments)
			protected.POST("/departments", server.createDepartment)
			protected.PATCH("/departments/:id", server.updateDepartment)
			protected.DELETE("/departments/:id", server.deleteDepartment)

			protected.GET("/roles", server.listRoles)
			protected.POST("/roles", server.createRole)
			protected.PATCH("/roles/:id", server.updateRole)
					   // protected.DELETE("/roles/:id", server.deleteRole)

				protected.GET("/users", server.listUsers)
			protected.GET("/users/meta/options", server.userMetaOptions)
			protected.GET("/users/export", server.exportUsersCSV)
			protected.GET("/users/import-template", server.exportUserImportTemplate)
			protected.GET("/users/import-template-minimal", server.exportUserImportMinimalTemplate)
			protected.POST("/users/import", server.importUsersCSV)
			protected.GET("/integrations/install-config", server.getInstallConfig)
			protected.GET("/integrations/mattermost/status", server.getMattermostStatus)
			protected.GET("/settings/workflow", server.getWorkflowSettings)
			protected.PUT("/settings/workflow", server.updateWorkflowSettings)
			protected.POST("/users", server.createUser)
			protected.GET("/users/:id", server.getUser)
			protected.PATCH("/users/:id", server.updateUser)
			protected.DELETE("/users/:id", server.deactivateUser)
			protected.GET("/users/:id/assets", server.getUserAssets)
			protected.GET("/me/profile", server.getMyProfile)
			protected.PATCH("/me/profile", server.updateMyProfile)
			protected.GET("/me/assets", server.getMyAssets)

			protected.GET("/devices", server.listDevicesCompat)
			protected.GET("/devices/:id", server.getDeviceCompat)
			protected.GET("/inventory-sync/status", server.getInventorySyncStatus)
			protected.POST("/inventory-sync/run", server.runInventorySync)
			protected.GET("/devices/:id/alerts", server.getDeviceAlertsCompat)
			protected.GET("/alerts/dashboard", server.alertsDashboard)
			protected.GET("/alerts", server.listAlerts)
			protected.GET("/me/alerts/dashboard", server.listMyAlertsDashboard)
			protected.GET("/me/alerts", server.listMyAlerts)
			protected.PUT("/alerts/:id/acknowledge", server.acknowledgeAlert)
			protected.PUT("/alerts/:id/resolve", server.resolveAlert)
			protected.GET("/announcements", server.listAnnouncements)
			protected.POST("/announcements", server.createAnnouncement)
			protected.POST("/announcements/:id/read", server.markAnnouncementRead)
			protected.GET("/gatepass", server.listGatepasses)
			protected.POST("/gatepass", server.createGatepass)
			protected.PUT("/gatepass/:id/approve", server.approveGatepass)
			protected.PUT("/gatepass/:id/reject", server.rejectGatepass)
			protected.POST("/gatepass/:id/complete", server.completeGatepass)
			protected.POST("/gatepass/:id/receiver-upload", server.uploadReceiverSignedGatepass)
			protected.GET("/gatepass/:id/receiver-upload", server.downloadReceiverSignedGatepass)
			protected.GET("/inventory", server.listInventory)
			protected.POST("/inventory", server.createInventoryItem)
			protected.PATCH("/inventory/:id", server.updateInventoryItem)
			protected.DELETE("/inventory/:id", server.deleteInventoryItem)
			protected.POST("/inventory/:id/allocate", server.allocateInventoryItem)
			protected.POST("/inventory/:id/return", server.returnInventoryItem)
			protected.POST("/inventory/:id/retire", server.retireInventoryItem)
			protected.GET("/inventory/module/options", server.inventoryModuleOptions)
			protected.GET("/inventory/module/assets", server.inventoryModuleAssets)
			protected.POST("/inventory/module/assets", server.createInventoryModuleAsset)
			protected.PATCH("/inventory/module/assets/:id", server.updateInventoryModuleAsset)
			protected.DELETE("/inventory/module/assets/:id", server.deleteInventoryModuleAsset)
			protected.GET("/inventory/module/items", server.inventoryModuleItems)
			protected.POST("/inventory/module/items", server.createInventoryModuleItem)
			protected.GET("/items", server.inventoryModuleItems)
			protected.POST("/items", server.createInventoryModuleItem)
			protected.PATCH("/inventory/module/items/:id", server.updateInventoryModuleItem)
			protected.DELETE("/inventory/module/items/:id", server.deleteInventoryModuleItem)
			protected.GET("/inventory/module/sub-items", server.inventoryModuleSubItems)
			protected.POST("/inventory/module/sub-items", server.createInventoryModuleSubItem)
			protected.GET("/sub-items", server.inventoryModuleSubItems)
			protected.POST("/sub-items", server.createInventoryModuleSubItem)
			protected.PATCH("/inventory/module/sub-items/:id", server.updateInventoryModuleSubItem)
			protected.DELETE("/inventory/module/sub-items/:id", server.deleteInventoryModuleSubItem)
			protected.GET("/inventory/module/suppliers", server.inventoryModuleSuppliers)
			protected.POST("/inventory/module/suppliers", server.createInventoryModuleSupplier)
			protected.PATCH("/inventory/module/suppliers/:id", server.updateInventoryModuleSupplier)
			protected.DELETE("/inventory/module/suppliers/:id", server.deleteInventoryModuleSupplier)
			protected.GET("/inventory/module/branches", server.inventoryModuleBranches)
			protected.POST("/inventory/module/branches", server.createInventoryModuleBranch)
			protected.PATCH("/inventory/module/branches/:id", server.updateInventoryModuleBranch)
			protected.DELETE("/inventory/module/branches/:id", server.deleteInventoryModuleBranch)
			protected.POST("/inventory/module/stock", server.inventoryModuleStockOperation)
			protected.GET("/inventory/module/export", server.exportInventoryModuleCSV)
			protected.GET("/inventory/module/template", server.exportInventoryModuleTemplate)
			protected.POST("/inventory/module/import", server.importInventoryModuleCSV)
			   // Inventory item CSV endpoints
			protected.GET("/inventory/export", server.exportInventoryItemsCSV)
			protected.GET("/inventory/import-template", server.exportInventoryItemImportTemplate)
			protected.POST("/inventory/import", server.importInventoryItemsCSV)
			protected.GET("/me/requests", server.listMyRequests)
			protected.POST("/me/requests", server.createMyRequest)
			protected.GET("/me/requests/:id", server.getMyRequest)
			protected.POST("/me/requests/:id/comment", server.commentMyRequest)
			protected.GET("/requests", server.listRequests)
			protected.PUT("/requests/:id/status", server.updateRequestStatus)
			protected.POST("/requests/:id/assign", server.assignRequest)
			protected.GET("/chat/channels", server.listChatChannels)
			protected.GET("/chat/tickets/summary", server.listChatTicketSummary)
			protected.POST("/chat/channels", server.createChatChannel)
			protected.POST("/chat/channels/:id/members", server.addChatChannelMembers)
			protected.DELETE("/chat/channels/:id/members/:userId", server.removeChatChannelMember)
			protected.PUT("/chat/channels/:id/owner", server.updateChatChannelOwner)
			protected.PUT("/chat/channels/:id/close", server.closeChatChannel)
			protected.PUT("/chat/channels/:id/reopen", server.reopenChatChannel)
			protected.DELETE("/chat/channels/:id", server.deleteChatChannel)
			protected.GET("/chat/channels/:id/messages", server.listChatMessages)

			// IT Documentation (knowledge base)
			protected.GET("/docs/categories", server.listDocsCategories)
			protected.POST("/docs/categories", server.createDocsCategory)
			protected.GET("/docs/pages", server.listDocsPages)
			protected.GET("/docs/pages/:id", server.getDocsPage)
			protected.POST("/docs/pages", server.createDocsPage)
			protected.PUT("/docs/pages/:id", server.updateDocsPage)
			protected.DELETE("/docs/pages/:id", server.deleteDocsPage)

			// Secure Credential Vault
			protected.GET("/vault", server.listVaultCredentials)
			protected.POST("/vault", server.createVaultCredential)
			protected.POST("/vault/:id/reveal", server.revealVaultCredential)
			protected.DELETE("/vault/:id", server.deleteVaultCredential)
			protected.GET("/vault/:id/access-log", server.getVaultAccessLog)

			protected.GET("/patch/dashboard", server.patchDashboardCompat)
			protected.GET("/patch/devices", server.patchDevicesCompat)
			protected.GET("/patch/jobs", server.patchJobsCompat)
			protected.GET("/patch/reports", server.listPatchRunReports)
			protected.GET("/patch/reports/:id", server.getPatchRunReport)
			protected.POST("/patch/reports", server.createPatchRunReport)
			protected.POST("/patch/run", server.patchRunCompat)
			protected.GET("/salt/workspace", server.saltWorkspace)
			protected.GET("/salt/workspace/templates", server.getSaltWorkspaceTemplates)
			protected.PUT("/salt/workspace/templates", server.updateSaltWorkspaceTemplates)
			protected.POST("/salt/workspace/execute", server.executeSaltWorkspaceAction)
			protected.GET("/ssh/assets/:id", server.getSSHTarget)
			protected.POST("/ssh/session", server.createSSHSession)
			protected.GET("/terminal/session", server.listTerminalSessionsCompat)
			protected.POST("/terminal/session", server.createTerminalSessionCompat)
			protected.GET("/terminal/targets/:minionId", server.getTerminalTarget)
			protected.POST("/terminal/targets/:minionId/execute", server.executeTerminalCommand)
			protected.POST("/terminal/targets/:minionId/function", server.executeTerminalFunction)

			protected.GET("/assets", server.listAssets)
			protected.POST("/assets", server.createAsset)
			protected.GET("/assets/:id", server.getAsset)
			protected.PATCH("/assets/:id", server.updateAsset)
			protected.DELETE("/assets/:id", server.deleteAsset)
			protected.PUT("/assets/:id/maintenance", server.setAssetMaintenance)
			protected.PUT("/assets/maintenance/bulk", server.setBulkAssetMaintenance)
			protected.POST("/assets/:id/assign", server.assignAsset)
			protected.POST("/assets/:id/unassign", server.unassignAsset)
			protected.GET("/assets/:id/history", server.getAssetHistory)
			protected.GET("/assets/:id/alerts", server.getAssetAlerts)
			protected.POST("/assets/:id/patch", server.runAssetPatch)
			protected.POST("/assets/:id/script", server.runAssetScript)
			protected.GET("/assets/:id/terminal", server.getAssetTerminal)
			protected.GET("/assets/:id/docs", server.getAssetDocs)
			protected.GET("/assets/hostname/suggest", server.suggestHostname)

			protected.GET("/audit", server.listAudit)
			protected.GET("/audit/:id", server.getAudit)
			protected.GET("/audit/export", server.exportAudit)
		}
	}

	return router
}

func (server *apiServer) downloadInstallerScript(fileName string, contentType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		content, err := loadInstallerScript(fileName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "installer_script_unavailable"})
			return
		}

		c.Header("Content-Type", contentType)
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
		c.String(http.StatusOK, string(content))
	}
}

func loadInstallerScript(fileName string) ([]byte, error) {
	paths := []string{
		filepath.Join("..", "scripts", fileName),
		filepath.Join("scripts", fileName),
	}

	for _, candidate := range paths {
		content, err := os.ReadFile(candidate)
		if err == nil {
			return content, nil
		}
	}

	return nil, fmt.Errorf("installer script %s not found", fileName)
}

func (server *apiServer) registerAuthRoutes(api *gin.RouterGroup) {
	// Auth endpoints with strict rate limiting (5 req/min)
	auth := api.Group("/auth")
	auth.Use(middleware.RateLimit(true)) // 5 req/min for auth
	{
		auth.GET("/providers", server.authProviders)
		auth.POST("/login", server.login)
		auth.POST("/login/verify-mfa", server.loginVerifyMFA)
		auth.POST("/google", server.loginWithGoogleIDToken)
		auth.GET("/google", server.googleRedirect)
		auth.GET("/google/callback", server.googleCallback)
		auth.POST("/logout", server.logout)
		auth.GET("/me", middleware.AuthRequired(server.auth), server.me)
		
		// MFA endpoints (require authentication)
		auth.POST("/mfa/setup", middleware.AuthRequired(server.auth), server.setupMFA)
		auth.POST("/mfa/verify", middleware.AuthRequired(server.auth), server.verifyMFA)
		auth.POST("/mfa/disable", middleware.AuthRequired(server.auth), server.disableMFA)
		auth.GET("/mfa/status", middleware.AuthRequired(server.auth), server.getMFAStatus)
	}
}

func (server *apiServer) authProviders(c *gin.Context) {
	httpx.JSON(c, http.StatusOK, gin.H{
		"google": gin.H{
			"enabled":  server.googleSSO != nil && server.googleSSO.Enabled(),
			"clientId": server.config.GoogleClientID,
		},
	})
}

func (server *apiServer) rejectAuthAttempt(c *gin.Context, limiterKey string) {
	server.authLimiter.RegisterFailure(limiterKey)
	httpx.Error(c, http.StatusUnauthorized, "authentication failed")
}

func (server *apiServer) login(c *gin.Context) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := bindJSONWithLimit(c, &input, 32<<10); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid login payload")
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	limiterKey := authLimiterKey(c, email)
	if !server.authLimiter.Allow(limiterKey) {
		httpx.Error(c, http.StatusTooManyRequests, "too many login attempts, try again later")
		return
	}
	// Validate email domain against configured hosted domain
	if server.config.GoogleHostedDomain != "" && !strings.HasSuffix(email, "@"+server.config.GoogleHostedDomain) {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	user, err := server.fetchUserByEmail(email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			server.rejectAuthAttempt(c, limiterKey)
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !userIsActive(user) {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}
	if err := authn.CheckPassword(input.Password, user.PasswordHash); err != nil {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	// Check if MFA is enabled
	if user.MFAEnabled {
		// Password verified, but MFA required - don't issue token yet
		server.authLimiter.Reset(limiterKey)
		httpx.JSON(c, http.StatusOK, gin.H{
			"mfaRequired": true,
			"email":       user.Email,
			"message":     "MFA verification required",
		})
		return
	}

	// No MFA - issue token immediately
	server.authLimiter.Reset(limiterKey)
	server.issueAuthResponse(c, user, "password")
}

func (server *apiServer) loginWithGoogleIDToken(c *gin.Context) {
	var input struct {
		IDToken string `json:"idToken"`
		Email   string `json:"email"`
	}
	if err := bindJSONWithLimit(c, &input, 32<<10); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid google sign-in payload")
		return
	}
	limiterKey := authLimiterKey(c, strings.ToLower(strings.TrimSpace(input.Email)))
	if !server.authLimiter.Allow(limiterKey) {
		httpx.Error(c, http.StatusTooManyRequests, "too many login attempts, try again later")
		return
	}

	claims, err := server.parseGoogleIDToken(input.IDToken)
	if err != nil {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	email := strings.ToLower(strings.TrimSpace(claims.Email))
	requestedEmail := strings.ToLower(strings.TrimSpace(input.Email))
	if requestedEmail != "" && requestedEmail != email {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}
	limiterKey = authLimiterKey(c, email)
	if !server.authLimiter.Allow(limiterKey) {
		httpx.Error(c, http.StatusTooManyRequests, "too many login attempts, try again later")
		return
	}
	// Validate email domain against configured hosted domain
	if server.config.GoogleHostedDomain != "" && !strings.HasSuffix(email, "@"+server.config.GoogleHostedDomain) {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	user, err := server.fetchUserByEmail(email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			server.rejectAuthAttempt(c, limiterKey)
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !userIsActive(user) {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	server.authLimiter.Reset(limiterKey)
	server.issueAuthResponse(c, user, "google_sso")
}

func (server *apiServer) googleRedirect(c *gin.Context) {
	if server.googleSSO == nil || !server.googleSSO.Enabled() {
		httpx.Error(c, http.StatusNotImplemented, "google sso is not configured")
		return
	}
	state, err := server.auth.IssueState("google_oauth")
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, server.googleSSO.AuthCodeURL(state))
}

func (server *apiServer) googleCallback(c *gin.Context) {
	if server.googleSSO == nil || !server.googleSSO.Enabled() {
		httpx.Error(c, http.StatusNotImplemented, "google sso is not configured")
		return
	}
	if err := server.auth.ValidateState(c.Query("state"), "google_oauth"); err != nil {
		httpx.Error(c, http.StatusUnauthorized, "invalid oauth state")
		return
	}
	profile, err := server.googleSSO.ExchangeCode(c.Request.Context(), c.Query("code"))
	if err != nil {
		httpx.Error(c, http.StatusUnauthorized, err.Error())
		return
	}
	user, err := server.fetchUserByEmail(strings.ToLower(profile.Email))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusUnauthorized, "unregistered email")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	token, err := server.issueToken(user)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	redirectURL, _ := url.Parse(server.config.FrontendOrigin)
	redirectURL.Path = "/login"
	query := redirectURL.Query()
	query.Set("token", token)
	redirectURL.RawQuery = query.Encode()
	c.Redirect(http.StatusTemporaryRedirect, redirectURL.String())
}

func (server *apiServer) logout(c *gin.Context) {
	middleware.TagAudit(c, middleware.AuditMeta{Action: "logout", TargetType: "session", AuthMethod: "jwt"})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) me(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	user, err := server.fetchUserByID(claims.UserID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, server.userAuthPayload(user))
}

func (server *apiServer) getMyProfile(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	user, err := server.fetchUserByID(claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "user not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{
		"id": user.ID, "emp_id": user.EmpID, "full_name": user.FullName, "email": user.Email, "entity_id": user.EntityID, "dept_id": user.DeptID,
		"location_id": user.LocationID, "role": user.Role, "status": map[bool]string{true: "active", false: "inactive"}[user.IsActive],
	})
}

func (server *apiServer) listEntities(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee") {
		return
	}
	rows, err := server.db.Query(`SELECT id, short_code, full_name, is_active, created_at FROM entities ORDER BY short_code`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	result := make([]gin.H, 0)
	for rows.Next() {
		var id, shortCode, fullName string
		var isActive bool
		var createdAt time.Time
		if err := rows.Scan(&id, &shortCode, &fullName, &isActive, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if !server.entityAllowed(c, id) {
			continue
		}
		result = append(result, gin.H{"id": id, "short_code": shortCode, "full_name": fullName, "is_active": isActive, "created_at": createdAt})
	}
	httpx.JSON(c, http.StatusOK, result)
}


func (server *apiServer) updateEntity(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct {
		ShortCode string `json:"short_code"`
		FullName  string `json:"full_name"`
		IsActive  *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid entity payload")
		return
	}
	_, err := server.db.Exec(`
		UPDATE entities
		SET short_code = COALESCE(NULLIF($2, ''), short_code),
			full_name = COALESCE(NULLIF($3, ''), full_name),
			is_active = COALESCE($4, is_active),
			updated_at = NOW()
		WHERE id = $1
	`, c.Param("id"), strings.ToUpper(strings.TrimSpace(input.ShortCode)), strings.TrimSpace(input.FullName), input.IsActive)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "settings_changed", TargetType: "entity", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) listLocations(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee") {
		return
	}
	entityID := c.Query("entity_id")
	rows, err := server.db.Query(`
		SELECT l.id, l.entity_id, e.short_code, l.location_code, l.full_name, l.city, l.state, l.is_active, l.created_at
		FROM locations l
		JOIN entities e ON e.id = l.entity_id
		WHERE ($1 = '' OR l.entity_id = $1::uuid)
		ORDER BY e.short_code, l.location_code
	`, entityID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	result := make([]gin.H, 0)
	for rows.Next() {
		var id, entityRef, entityCode, code, fullName, city, state string
		var active bool
		var createdAt time.Time
		if err := rows.Scan(&id, &entityRef, &entityCode, &code, &fullName, &city, &state, &active, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if !server.entityAllowedByID(c, entityRef) {
			continue
		}
		result = append(result, gin.H{"id": id, "entity_id": entityRef, "entity_code": entityCode, "location_code": code, "full_name": fullName, "city": city, "state": state, "is_active": active, "created_at": createdAt})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) createLocation(c *gin.Context) { server.upsertLocation(c, true) }
func (server *apiServer) updateLocation(c *gin.Context) { server.upsertLocation(c, false) }

func (server *apiServer) upsertLocation(c *gin.Context, create bool) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct {
		EntityID     string `json:"entity_id"`
		LocationCode string `json:"location_code"`
		FullName     string `json:"full_name"`
		City         string `json:"city"`
		State        string `json:"state"`
		IsActive     *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid location payload")
		return
	}
	active := true
	if input.IsActive != nil {
		active = *input.IsActive
	}
	if create {
		var id string
		err := server.db.QueryRow(`
			INSERT INTO locations (entity_id, location_code, full_name, city, state, is_active)
			VALUES ($1::uuid, $2, $3, $4, $5, $6)
			RETURNING id
		`, input.EntityID, strings.ToUpper(strings.TrimSpace(input.LocationCode)), strings.TrimSpace(input.FullName), strings.TrimSpace(input.City), strings.TrimSpace(input.State), active).Scan(&id)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		middleware.TagAudit(c, middleware.AuditMeta{Action: "location_created", TargetType: "location", TargetID: id, Detail: input})
		httpx.Created(c, gin.H{"id": id})
		return
	}
	_, err := server.db.Exec(`
		UPDATE locations
		SET entity_id = COALESCE(NULLIF($2, '')::uuid, entity_id),
			location_code = COALESCE(NULLIF($3, ''), location_code),
			full_name = COALESCE(NULLIF($4, ''), full_name),
			city = COALESCE($5, city),
			state = COALESCE($6, state),
			is_active = COALESCE($7, is_active),
			updated_at = NOW()
		WHERE id = $1::uuid
	`, c.Param("id"), input.EntityID, strings.ToUpper(strings.TrimSpace(input.LocationCode)), strings.TrimSpace(input.FullName), strings.TrimSpace(input.City), strings.TrimSpace(input.State), input.IsActive)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "settings_changed", TargetType: "location", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) listDepartments(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee") {
		return
	}
	entityID := c.Query("entity_id")
	rows, err := server.db.Query(`
		SELECT d.id, d.entity_id, e.short_code, d.name, d.short_code, COALESCE(d.description, ''), d.created_at,
			(SELECT COUNT(*) FROM users u WHERE u.dept_id = d.id AND u.is_active = TRUE) AS user_count
		FROM departments d
		JOIN entities e ON e.id = d.entity_id
		WHERE ($1 = '' OR d.entity_id = $1::uuid)
		ORDER BY e.short_code, d.name
	`, entityID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	result := make([]gin.H, 0)
	for rows.Next() {
		var id, entityRef, entityCode, name, shortCode, description string
		var createdAt time.Time
		var userCount int
		if err := rows.Scan(&id, &entityRef, &entityCode, &name, &shortCode, &description, &createdAt, &userCount); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if !server.entityAllowedByID(c, entityRef) {
			continue
		}
		result = append(result, gin.H{"id": id, "entity_id": entityRef, "entity_code": entityCode, "name": name, "short_code": shortCode, "description": description, "user_count": userCount, "created_at": createdAt})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) createDepartment(c *gin.Context) { server.upsertDepartment(c, true) }
func (server *apiServer) updateDepartment(c *gin.Context) { server.upsertDepartment(c, false) }

func (server *apiServer) upsertDepartment(c *gin.Context, create bool) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct {
		EntityID    string `json:"entity_id"`
		Name        string `json:"name"`
		ShortCode   string `json:"short_code"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid department payload")
		return
	}
	shortCode := normalizeHostnameComponent(input.ShortCode)
	if shortCode == "" {
		shortCode = normalizeHostnameComponent(input.Name)
	}
	if create {
		var id string
		err := server.db.QueryRow(`
			INSERT INTO departments (entity_id, name, short_code, description)
			VALUES ($1::uuid, $2, $3, NULLIF($4, ''))
			RETURNING id
		`, input.EntityID, strings.TrimSpace(input.Name), shortCode, strings.TrimSpace(input.Description)).Scan(&id)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		middleware.TagAudit(c, middleware.AuditMeta{Action: "dept_created", TargetType: "department", TargetID: id, Detail: input})
		httpx.Created(c, gin.H{"id": id})
		return
	}
	_, err := server.db.Exec(`
		UPDATE departments
		SET entity_id = COALESCE(NULLIF($2, '')::uuid, entity_id),
			name = COALESCE(NULLIF($3, ''), name),
			short_code = COALESCE(NULLIF($4, ''), short_code),
			description = COALESCE($5, description),
			updated_at = NOW()
		WHERE id = $1::uuid
	`, c.Param("id"), input.EntityID, strings.TrimSpace(input.Name), shortCode, strings.TrimSpace(input.Description))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "settings_changed", TargetType: "department", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deleteDepartment(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	_, err := server.db.Exec(`UPDATE departments SET updated_at = NOW(), description = COALESCE(description, '') || '' WHERE id = $1::uuid`, c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "settings_changed", TargetType: "department", TargetID: c.Param("id"), Detail: gin.H{"deleted": true}})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true, "note": "hard delete disabled; department left in place for referential safety"})
}

func (server *apiServer) listRoles(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	rows, err := server.db.Query(`
		SELECT r.id, r.name, r.is_system,
			COALESCE(json_agg(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL), '[]'::json)
		FROM roles r
		LEFT JOIN role_permissions rp ON rp.role_id = r.id
		LEFT JOIN permissions p ON p.id = rp.permission_id
		GROUP BY r.id, r.name, r.is_system
		ORDER BY r.name
	`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	result := make([]gin.H, 0)
	for rows.Next() {
		var id, name string
		var system bool
		var permissionsRaw []byte
		if err := rows.Scan(&id, &name, &system, &permissionsRaw); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		var permissions []string
		_ = json.Unmarshal(permissionsRaw, &permissions)
		result = append(result, gin.H{"id": id, "name": name, "is_system": system, "permissions": permissions})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) createRole(c *gin.Context) { server.upsertRole(c, true) }
func (server *apiServer) updateRole(c *gin.Context) { server.upsertRole(c, false) }

func (server *apiServer) upsertRole(c *gin.Context, create bool) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct {
		Name        string   `json:"name"`
		Permissions []string `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid role payload")
		return
	}
	var roleID string
	if create {
		if err := server.db.QueryRow(`INSERT INTO roles (name, is_system) VALUES ($1, FALSE) RETURNING id`, strings.TrimSpace(input.Name)).Scan(&roleID); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	} else {
		roleID = c.Param("id")
		if _, err := server.db.Exec(`UPDATE roles SET name = COALESCE(NULLIF($2, ''), name), updated_at = NOW() WHERE id = $1::uuid`, roleID, strings.TrimSpace(input.Name)); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		if _, err := server.db.Exec(`DELETE FROM role_permissions WHERE role_id = $1::uuid`, roleID); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
	}
	for _, key := range input.Permissions {
		if _, err := server.db.Exec(`
			INSERT INTO role_permissions (role_id, permission_id)
			SELECT $1::uuid, id FROM permissions WHERE key = $2
		`, roleID, key); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "role_changed", TargetType: "role", TargetID: roleID, Detail: input})
	if create {
		httpx.Created(c, gin.H{"id": roleID})
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}


func (server *apiServer) getUser(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	user, err := server.fetchUserByID(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "user not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if isSyntheticTestIdentity(user.FullName, user.Email, user.EmpID) {
		httpx.Error(c, http.StatusNotFound, "user not found")
		return
	}
	if !server.userVisibleByEntity(c, user.EntityID, user.ID) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{
		"id": user.ID, "emp_id": user.EmpID, "full_name": user.FullName, "email": user.Email, "entity_id": user.EntityID, "dept_id": user.DeptID,
		"location_id": user.LocationID, "role": user.Role, "status": map[bool]string{true: "active", false: "inactive"}[user.IsActive],
	})
}

func (server *apiServer) listUsers(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	page, pageSize, paginate := parsePaginationRequest(c, 25)
	entityID := strings.TrimSpace(c.Query("entity"))
	deptID := strings.TrimSpace(c.Query("dept"))
	locationID := strings.TrimSpace(c.Query("location"))
	roleNames := c.QueryArray("role")
	if len(roleNames) == 0 {
		if roleName := strings.TrimSpace(c.Query("role")); roleName != "" {
			roleNames = append(roleNames, roleName)
		}
	}
	excludeRole := strings.TrimSpace(c.Query("exclude_role"))
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	search := strings.TrimSpace(strings.ToLower(c.Query("search")))
	departmentLabel := strings.TrimSpace(c.Query("department_label"))
	includeTestUsers := c.Query("include_test_users") == "1"

	if entityID != "" && claims.Role != "super_admin" && !server.entityAllowedByID(c, entityID) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}

	whereClauses := []string{"1 = 1"}
	args := make([]any, 0, 16)
	argIndex := 1

	if claims.Role == "employee" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.id = $%d::uuid", argIndex))
		args = append(args, claims.UserID)
		argIndex++
	} else if claims.Role != "super_admin" {
		entityArg := argIndex
		userArg := argIndex + 1
		whereClauses = append(whereClauses, fmt.Sprintf("(u.entity_id = $%d::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $%d::uuid AND uea.entity_id = u.entity_id))", entityArg, userArg))
		args = append(args, claims.EntityID, claims.UserID)
		argIndex += 2
	}
	if entityID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.entity_id = $%d::uuid", argIndex))
		args = append(args, entityID)
		argIndex++
	}
	if deptID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.dept_id = $%d::uuid", argIndex))
		args = append(args, deptID)
		argIndex++
	}
	if locationID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.location_id = $%d::uuid", argIndex))
		args = append(args, locationID)
		argIndex++
	}
	if len(roleNames) > 0 {
		placeholders := make([]string, 0, len(roleNames))
		for _, roleName := range roleNames {
			trimmed := strings.TrimSpace(roleName)
			if trimmed == "" {
				continue
			}
			placeholders = append(placeholders, fmt.Sprintf("$%d", argIndex))
			args = append(args, trimmed)
			argIndex++
		}
		if len(placeholders) > 0 {
			whereClauses = append(whereClauses, "r.name IN ("+strings.Join(placeholders, ", ")+")")
		}
	}
	if excludeRole != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("r.name <> $%d", argIndex))
		args = append(args, excludeRole)
		argIndex++
	}
	if status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END) = $%d", argIndex))
		args = append(args, status)
		argIndex++
	}
	if !includeTestUsers {
		whereClauses = append(whereClauses, "lower(u.full_name) NOT LIKE '%probe%' AND lower(u.full_name) NOT LIKE '%smoke%' AND lower(COALESCE(u.email, '')) NOT LIKE '%probe%' AND lower(COALESCE(u.email, '')) NOT LIKE '%smoke%' AND lower(COALESCE(u.emp_id, '')) NOT LIKE '%probe%' AND lower(COALESCE(u.emp_id, '')) NOT LIKE '%smoke%'")
	}
	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(lower(COALESCE(u.full_name, '')) LIKE $%d OR lower(COALESCE(u.email, '')) LIKE $%d OR lower(COALESCE(u.emp_id, '')) LIKE $%d)", argIndex, argIndex, argIndex))
		args = append(args, "%"+search+"%")
		argIndex++
	}
	departmentExpr := "COALESCE(NULLIF(d.name, ''), NULLIF(l.full_name, ''), 'Unassigned')"
	if departmentLabel != "" && departmentLabel != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf(departmentExpr+" = $%d", argIndex))
		args = append(args, departmentLabel)
		argIndex++
	}

	fromClause := `
		FROM users u
		LEFT JOIN roles r ON r.id = u.role_id
		LEFT JOIN departments d ON d.id = u.dept_id
		LEFT JOIN locations l ON l.id = u.location_id
		WHERE ` + strings.Join(whereClauses, " AND ")

	query := `
		SELECT u.id::text,
		       COALESCE(u.full_name, ''),
		       COALESCE(u.email, ''),
		       COALESCE(u.emp_id, ''),
		       CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END,
		       COALESCE(u.entity_id::text, ''),
		       COALESCE(u.dept_id::text, ''),
		       COALESCE(u.location_id::text, ''),
		       COALESCE(r.name, ''),
		       COALESCE(d.name, ''),
		       COALESCE(l.full_name, ''),
		       (
		         (SELECT COUNT(*) FROM assets a WHERE a.assigned_to = u.id) +
		         (SELECT COUNT(*) FROM stock_items s WHERE s.assigned_user_id = u.id)
		       ) AS asset_count,
		       COUNT(*) OVER()
		` + fromClause + `
		ORDER BY COALESCE(u.full_name, ''), COALESCE(u.email, ''), u.id`

	queryArgs := append([]any{}, args...)
	if paginate {
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
		queryArgs = append(queryArgs, pageSize, (page-1)*pageSize)
	}

	rows, err := server.db.Query(query, queryArgs...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	departmentCounts := map[string]int{}
	total := 0
	assetTotal := 0
	for rows.Next() {
		var id, fullName, email, empID, statusValue, entityRef, deptRef, locationRef, roleName, departmentName, locationName string
		var assetCount, count int
		if err := rows.Scan(&id, &fullName, &email, &empID, &statusValue, &entityRef, &deptRef, &locationRef, &roleName, &departmentName, &locationName, &assetCount, &count); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		total = count
		label := strings.TrimSpace(departmentName)
		if label == "" {
			label = strings.TrimSpace(locationName)
		}
		if label == "" {
			label = "Unassigned"
		}
		departmentCounts[label]++
		assetTotal += assetCount
		items = append(items, gin.H{
			"id": id,
			"full_name": fullName,
			"email": email,
			"emp_id": empID,
			"status": statusValue,
			"entity_id": emptyToNil(entityRef),
			"dept_id": emptyToNil(deptRef),
			"location_id": emptyToNil(locationRef),
			"role": emptyToNil(roleName),
			"department": emptyToNil(departmentName),
			"location": emptyToNil(locationName),
			"asset_count": assetCount,
		})
	}
	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !paginate {
		total = len(items)
	}

	countRows, err := server.db.Query(`
		SELECT department_label, COUNT(*)
		FROM (
			SELECT ` + departmentExpr + ` AS department_label
			` + fromClause + `
		) summary_users
		GROUP BY department_label
		ORDER BY COUNT(*) DESC, department_label ASC
	`, args...)
	if err == nil {
		defer countRows.Close()
		departmentCounts = map[string]int{}
		for countRows.Next() {
			var name string
			var count int
			if err := countRows.Scan(&name, &count); err != nil {
				departmentCounts = map[string]int{}
				break
			}
			departmentCounts[name] = count
		}
	}

	summaryItems := make([]gin.H, 0, len(departmentCounts))
	departmentNames := make([]string, 0, len(departmentCounts))
	for name := range departmentCounts {
		departmentNames = append(departmentNames, name)
	}
	sort.Strings(departmentNames)
	for _, name := range departmentNames {
		summaryItems = append(summaryItems, gin.H{"name": name, "count": departmentCounts[name]})
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page": page,
		"pageSize": pageSize,
		"summary": gin.H{
			"departmentCounts": summaryItems,
			"assetTotal": assetTotal,
		},
	})
}

func (server *apiServer) createUser(c *gin.Context) { server.upsertUser(c, true) }
func (server *apiServer) updateUser(c *gin.Context) { server.upsertUser(c, false) }

func (server *apiServer) updateMyProfile(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	user, err := server.fetchUserByID(claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "user not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	var input struct {
		FullName   string `json:"full_name"`
		DeptID     string `json:"dept_id"`
		LocationID string `json:"location_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid profile payload")
		return
	}
	fullName := strings.TrimSpace(input.FullName)
	if fullName == "" {
		fullName = user.FullName
	}
	deptID := strings.TrimSpace(input.DeptID)
	locationID := strings.TrimSpace(input.LocationID)
	if err := server.validateEntityLinks(user.EntityID, deptID, locationID); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	_, err = server.db.Exec(`
		UPDATE users
		SET full_name = $2,
			dept_id = NULLIF($3, '')::uuid,
			location_id = NULLIF($4, '')::uuid,
			updated_at = NOW()
		WHERE id = $1::uuid
	`, user.ID, fullName, deptID, locationID)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	updatedUser, err := server.fetchUserByID(user.ID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "profile_updated", TargetType: "user", TargetID: user.ID, Detail: gin.H{"dept_id": deptID, "location_id": locationID}})
	httpx.JSON(c, http.StatusOK, server.userAuthPayload(updatedUser))
}

func (server *apiServer) upsertUser(c *gin.Context, create bool) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct {
		FullName        string `json:"full_name"`
		EmpID           string `json:"emp_id"`
		Email           string `json:"email"`
		EntityID        string `json:"entity_id"`
		DeptID          string `json:"dept_id"`
		LocationID      string `json:"location_id"`
		Role            string `json:"role"`
		InitialPassword string `json:"initial_password"`
		IsActive        *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid user payload")
		return
	}
	claims := middleware.CurrentClaims(c)
	effectiveEntityID := strings.TrimSpace(input.EntityID)
	effectiveDeptID := strings.TrimSpace(input.DeptID)
	effectiveLocationID := strings.TrimSpace(input.LocationID)
	effectiveEmail := strings.ToLower(strings.TrimSpace(input.Email))
	if !create {
		existingUser, err := server.fetchUserByID(c.Param("id"))
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				httpx.Error(c, http.StatusNotFound, "user not found")
				return
			}
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if effectiveEmail == "" {
			effectiveEmail = strings.ToLower(strings.TrimSpace(existingUser.Email))
		}
		if effectiveEntityID == "" {
			effectiveEntityID = strings.TrimSpace(existingUser.EntityID)
		}
		if effectiveDeptID == "" {
			effectiveDeptID = strings.TrimSpace(existingUser.DeptID)
		}
		if effectiveLocationID == "" {
			effectiveLocationID = strings.TrimSpace(existingUser.LocationID)
		}
		if strings.TrimSpace(input.Role) != "" && claims != nil && claims.Role != "super_admin" && strings.TrimSpace(input.Role) != strings.TrimSpace(existingUser.Role) {
			httpx.Error(c, http.StatusForbidden, "only super admin can update portal access")
			return
		}
	}
	// Validate email domain against configured hosted domain
	if server.config.GoogleHostedDomain != "" && !strings.HasSuffix(effectiveEmail, "@"+server.config.GoogleHostedDomain) {
		httpx.Error(c, http.StatusBadRequest, "email must belong to the @"+server.config.GoogleHostedDomain+" domain")
		return
	}
	if err := server.validateEntityLinks(effectiveEntityID, effectiveDeptID, effectiveLocationID); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	active := true
	if input.IsActive != nil {
		active = *input.IsActive
	}
	if create {
		if err := authn.ValidatePasswordStrength(input.InitialPassword); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		hash, err := authn.HashPassword(input.InitialPassword)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		var id string
		err = server.db.QueryRow(`
			INSERT INTO users (emp_id, full_name, email, entity_id, dept_id, location_id, role_id, password_hash, is_active)
			SELECT $1, $2, $3, $4::uuid, NULLIF($5, '')::uuid, NULLIF($6, '')::uuid, r.id, $7, $8
			FROM roles r WHERE r.name = $9
			RETURNING id
		`, strings.TrimSpace(input.EmpID), strings.TrimSpace(input.FullName), effectiveEmail, effectiveEntityID, effectiveDeptID, effectiveLocationID, hash, active, input.Role).Scan(&id)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		_, _ = server.db.Exec(`INSERT INTO user_entity_access (user_id, entity_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`, id, effectiveEntityID)
		middleware.TagAudit(c, middleware.AuditMeta{Action: "user_added", TargetType: "user", TargetID: id, Detail: input})
		httpx.Created(c, gin.H{"id": id})
		return
	}
	passwordHash := ""
	if strings.TrimSpace(input.InitialPassword) != "" {
		if err := authn.ValidatePasswordStrength(input.InitialPassword); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		hash, err := authn.HashPassword(input.InitialPassword)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		passwordHash = hash
	}
	_, err := server.db.Exec(`
		UPDATE users u
		SET emp_id = COALESCE(NULLIF($2, ''), emp_id),
			full_name = COALESCE(NULLIF($3, ''), full_name),
			email = COALESCE(NULLIF($4, ''), email),
			entity_id = COALESCE(NULLIF($5, '')::uuid, entity_id),
			dept_id = NULLIF($6, '')::uuid,
			location_id = NULLIF($7, '')::uuid,
			role_id = COALESCE((SELECT id FROM roles WHERE name = $8), role_id),
			is_active = COALESCE($9, is_active),
			password_hash = COALESCE(NULLIF($10, ''), password_hash),
			updated_at = NOW()
		WHERE u.id = $1::uuid
	`, c.Param("id"), strings.TrimSpace(input.EmpID), strings.TrimSpace(input.FullName), effectiveEmail, effectiveEntityID, effectiveDeptID, effectiveLocationID, input.Role, input.IsActive, passwordHash)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "user_updated", TargetType: "user", TargetID: c.Param("id"), Detail: gin.H{
		"full_name":      input.FullName,
		"emp_id":         input.EmpID,
		"email":          input.Email,
		"entity_id":      input.EntityID,
		"dept_id":        input.DeptID,
		"location_id":    input.LocationID,
		"role":           input.Role,
		"is_active":      input.IsActive,
		"password_reset": passwordHash != "",
	}})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deactivateUser(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	_, err := server.db.Exec(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1::uuid`, c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "user_deactivated", TargetType: "user", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) getUserAssets(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	user, err := server.fetchUserByID(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "user not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if isSyntheticTestIdentity(user.FullName, user.Email, user.EmpID) {
		httpx.Error(c, http.StatusNotFound, "user not found")
		return
	}
	if !server.userVisibleByEntity(c, user.EntityID, user.ID) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims != nil && claims.Role == "employee" && claims.UserID != c.Param("id") {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	devices, items, err := server.loadAssignedAssets(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{"devices": devices, "items": items})
}

func (server *apiServer) getMyAssets(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	devices, items, err := server.loadAssignedAssets(claims.UserID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{"devices": devices, "items": items})
}

func (server *apiServer) userMetaOptions(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	roles, err := server.simpleLookup(`SELECT id, name FROM roles ORDER BY name`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	claims := middleware.CurrentClaims(c)
	departmentsQuery := `SELECT id, name FROM departments ORDER BY name`
	departmentArgs := []any(nil)
	branchesQuery := `SELECT id, full_name AS name FROM locations ORDER BY full_name`
	branchArgs := []any(nil)
	if claims != nil && claims.Role != "super_admin" {
		departmentsQuery = `
			SELECT d.id, d.name
			FROM departments d
			WHERE d.entity_id = $1::uuid
			   OR EXISTS (
			       SELECT 1 FROM user_entity_access uea
			       WHERE uea.user_id = $2::uuid AND uea.entity_id = d.entity_id
			   )
			ORDER BY d.name`
		departmentArgs = []any{claims.EntityID, claims.UserID}
		branchesQuery = `
			SELECT l.id, l.full_name AS name
			FROM locations l
			WHERE l.entity_id = $1::uuid
			   OR EXISTS (
			       SELECT 1 FROM user_entity_access uea
			       WHERE uea.user_id = $2::uuid AND uea.entity_id = l.entity_id
			   )
			ORDER BY l.full_name`
		branchArgs = []any{claims.EntityID, claims.UserID}
	}
	departments, err := server.simpleLookupArgs(departmentsQuery, departmentArgs...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	branches, err := server.simpleLookupArgs(branchesQuery, branchArgs...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{"roles": roles, "departments": departments, "branches": branches})
}

func (server *apiServer) exportUserImportTemplate(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=user-import-template.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write(userImportCSVHeaders)
	exampleDomain := server.config.GoogleHostedDomain
	if exampleDomain == "" {
		exampleDomain = "example.com"
	}
	_ = writer.Write([]string{"", "jane.doe@" + exampleDomain, "EMP010", "", "ChangeMe123!", "employee", "", "", "active"})
	writer.Flush()
}

func (server *apiServer) exportUserImportMinimalTemplate(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=user-import-minimal-template.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write(userImportCSVHeaders)
	exampleDomain := server.config.GoogleHostedDomain
	if exampleDomain == "" {
		exampleDomain = "example.com"
	}
	_ = writer.Write([]string{"", "employee1@" + exampleDomain, "EMP1001", "", "ChangeMe123!", "employee", "", "", "active"})
	_ = writer.Write([]string{"", "employee2@" + exampleDomain, "EMP1002", "", "ChangeMe123!", "employee", "", "", "active"})
	writer.Flush()
}

func (server *apiServer) exportUsersCSV(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	entityID := c.Query("entity")
	deptID := c.Query("dept")
	locationID := c.Query("location")
	roleNames := c.QueryArray("role")
	roleLookup := map[string]struct{}{}
	normalizedRoles := make([]string, 0, len(roleNames))
	for _, roleName := range roleNames {
		roleName = strings.TrimSpace(roleName)
		if roleName != "" {
			roleLookup[roleName] = struct{}{}
			normalizedRoles = append(normalizedRoles, roleName)
		}
	}
	primaryRoleName := ""
	if len(roleLookup) == 1 {
		for _, roleName := range roleNames {
			roleName = strings.TrimSpace(roleName)
			if roleName != "" {
				primaryRoleName = roleName
				break
			}
		}
	} else if len(roleLookup) == 0 {
		primaryRoleName = c.Query("role")
	}
	if primaryRoleName != "" && len(normalizedRoles) == 0 {
		normalizedRoles = append(normalizedRoles, primaryRoleName)
		roleLookup[primaryRoleName] = struct{}{}
	}
	excludeRole := strings.TrimSpace(c.Query("exclude_role"))
	status := strings.ToLower(strings.TrimSpace(c.Query("status")))
	search := strings.TrimSpace(c.Query("search"))
	departmentLabel := strings.TrimSpace(c.Query("department_label"))
	includeTestUsers := c.Query("include_test_users") == "1"

	whereClauses := []string{"1 = 1"}
	args := make([]any, 0, 12)
	argIndex := 1

	if entityID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.entity_id = $%d::uuid", argIndex))
		args = append(args, entityID)
		argIndex++
	}
	if deptID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.dept_id = $%d::uuid", argIndex))
		args = append(args, deptID)
		argIndex++
	}
	if locationID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.location_id = $%d::uuid", argIndex))
		args = append(args, locationID)
		argIndex++
	}
	if len(normalizedRoles) > 0 {
		placeholders := make([]string, 0, len(normalizedRoles))
		for _, roleName := range normalizedRoles {
			placeholders = append(placeholders, fmt.Sprintf("$%d", argIndex))
			args = append(args, roleName)
			argIndex++
		}
		whereClauses = append(whereClauses, "r.name IN ("+strings.Join(placeholders, ", ")+")")
	}
	if excludeRole != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("r.name <> $%d", argIndex))
		args = append(args, excludeRole)
		argIndex++
	}
	if status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END) = $%d", argIndex))
		args = append(args, status)
		argIndex++
	}
	if !includeTestUsers {
		whereClauses = append(whereClauses, "lower(u.full_name) NOT LIKE '%probe%' AND lower(u.full_name) NOT LIKE '%smoke%' AND lower(u.email) NOT LIKE '%probe%' AND lower(u.email) NOT LIKE '%smoke%' AND lower(COALESCE(u.emp_id, '')) NOT LIKE '%probe%' AND lower(COALESCE(u.emp_id, '')) NOT LIKE '%smoke%'")
	}
	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(lower(u.full_name) LIKE $%d OR lower(u.email) LIKE $%d OR lower(u.emp_id) LIKE $%d)", argIndex, argIndex, argIndex))
		args = append(args, "%"+strings.ToLower(search)+"%")
		argIndex++
	}
	departmentExpr := "COALESCE(NULLIF(d.name, ''), NULLIF(l.full_name, ''), 'Unassigned')"
	if departmentLabel != "" && departmentLabel != "all" {
		whereClauses = append(whereClauses, fmt.Sprintf(departmentExpr+" = $%d", argIndex))
		args = append(args, departmentLabel)
		argIndex++
	}

	rows, err := server.db.Query(`
		SELECT u.full_name,
		       u.email,
		       u.emp_id,
		       COALESCE(d.name, ''),
		       '',
		       COALESCE(r.name, ''),
		       COALESCE(e.short_code, ''),
		       COALESCE(l.full_name, ''),
		       CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END
		FROM users u
		LEFT JOIN departments d ON d.id = u.dept_id
		LEFT JOIN roles r ON r.id = u.role_id
		LEFT JOIN entities e ON e.id = u.entity_id
		LEFT JOIN locations l ON l.id = u.location_id
		WHERE `+strings.Join(whereClauses, " AND ")+`
		ORDER BY u.full_name
	`, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=users-export.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write(userImportCSVHeaders)
	for rows.Next() {
		record := make([]string, len(userImportCSVHeaders))
		if err := rows.Scan(&record[0], &record[1], &record[2], &record[3], &record[4], &record[5], &record[6], &record[7], &record[8]); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		_ = writer.Write(record)
	}
	if err := rows.Err(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	writer.Flush()
}

func normalizeCSVHeader(value string) string {
	trimmed := strings.TrimSpace(strings.TrimPrefix(value, "\ufeff"))
	replacer := strings.NewReplacer(" ", "_", "-", "_", "/", "_")
	return strings.ToLower(replacer.Replace(trimmed))
}

func csvRowValue(row map[string]string, keys ...string) string {
	for _, key := range keys {
		if value, ok := row[normalizeCSVHeader(key)]; ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func normalizeLookupToken(value string) string {
	var builder strings.Builder
	for _, char := range strings.ToLower(strings.TrimSpace(value)) {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}

func parseCSVActiveValue(value string, fallback bool) (bool, error) {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return fallback, nil
	}
	switch trimmed {
	case "true", "1", "yes", "y", "active":
		return true, nil
	case "false", "0", "no", "n", "inactive":
		return false, nil
	default:
		return fallback, fmt.Errorf("invalid is_active value %q", value)
	}
}

func normalizeEmployeeCode(value string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(value))
	var builder strings.Builder
	for _, char := range trimmed {
		if (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
		}
	}
	normalized := builder.String()
	if normalized == "" {
		return "EMP"
	}
	if len(normalized) > 10 {
		return normalized[:10]
	}
	return normalized
}

func (server *apiServer) nextAvailableEmployeeCode(seed string, excludeUserID string) (string, error) {
	base := normalizeEmployeeCode(seed)
	for index := 0; index < 10000; index++ {
		candidate := base
		if index > 0 {
			suffix := strconv.Itoa(index)
			prefixLimit := 10 - len(suffix)
			if prefixLimit < 1 {
				prefixLimit = 1
			}
			trimmedBase := base
			if len(trimmedBase) > prefixLimit {
				trimmedBase = trimmedBase[:prefixLimit]
			}
			candidate = trimmedBase + suffix
		}
		var exists bool
		if err := server.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE emp_id = $1 AND ($2 = '' OR id <> $2::uuid))`, candidate, excludeUserID).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("could not allocate a unique employee code for %q", seed)
}

func (server *apiServer) resolveEntityIDFromCSV(value string, fallback string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return strings.TrimSpace(fallback), nil
	}
	normalized := normalizeLookupToken(trimmed)
	var id string
	err := server.db.QueryRow(`
		SELECT id
		FROM entities
		WHERE lower(short_code) = lower($1)
			OR lower(full_name) = lower($1)
			OR regexp_replace(lower(short_code), '[^a-z0-9]+', '', 'g') = $2
			OR regexp_replace(lower(full_name), '[^a-z0-9]+', '', 'g') = $2
		LIMIT 1
	`, trimmed, normalized).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("unknown entity %q", value)
		}
		return "", err
	}
	return id, nil
}

func (server *apiServer) resolveDepartmentIDFromCSV(value string, entityID string, fallback string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return strings.TrimSpace(fallback), nil
	}
	normalized := normalizeLookupToken(trimmed)
	var id string
	err := server.db.QueryRow(`
		SELECT id
		FROM departments
		WHERE entity_id = $1::uuid
		  AND (
			lower(name) = lower($2)
			OR lower(short_code) = lower($2)
			OR regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = $3
			OR regexp_replace(lower(short_code), '[^a-z0-9]+', '', 'g') = $3
		  )
		LIMIT 1
	`, entityID, trimmed, normalized).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("unknown department %q for selected entity", value)
		}
		return "", err
	}
	return id, nil
}

func (server *apiServer) resolveLocationIDFromCSV(value string, entityID string, fallback string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return strings.TrimSpace(fallback), nil
	}
	normalized := normalizeLookupToken(trimmed)
	var id string
	err := server.db.QueryRow(`
		SELECT id
		FROM locations
		WHERE entity_id = $1::uuid
		  AND (
			lower(full_name) = lower($2)
			OR lower(location_code) = lower($2)
			OR regexp_replace(lower(full_name), '[^a-z0-9]+', '', 'g') = $3
			OR regexp_replace(lower(location_code), '[^a-z0-9]+', '', 'g') = $3
		  )
		LIMIT 1
	`, entityID, trimmed, normalized).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("unknown location %q for selected entity", value)
		}
		return "", err
	}
	return id, nil
}

func (server *apiServer) resolveRoleIDFromCSV(value string) (string, string, error) {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		trimmed = "employee"
	}
	var id, name string
	err := server.db.QueryRow(`
		SELECT id, name
		FROM roles
		WHERE lower(name) = $1
		LIMIT 1
	`, trimmed).Scan(&id, &name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", fmt.Errorf("unknown role %q", value)
		}
		return "", "", err
	}
	return id, name, nil
}

func (server *apiServer) importUsersCSV(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	actor, err := server.fetchUserByID(claims.UserID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "csv file is required")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "failed to open uploaded csv")
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid csv file")
		return
	}
	if len(records) == 0 {
		httpx.Error(c, http.StatusBadRequest, "csv file is empty")
		return
	}

	headers := map[int]string{}
	availableHeaders := map[string]struct{}{}
	for index, header := range records[0] {
		normalized := normalizeCSVHeader(header)
		headers[index] = normalized
		availableHeaders[normalized] = struct{}{}
	}
	if _, ok := availableHeaders["full_name"]; !ok {
		if _, aliasOk := availableHeaders["username"]; !aliasOk {
			httpx.Error(c, http.StatusBadRequest, "csv must include a full_name column")
			return
		}
	}
	if _, ok := availableHeaders["email"]; !ok {
		if _, aliasOk := availableHeaders["email_id"]; !aliasOk {
			httpx.Error(c, http.StatusBadRequest, "csv must include an email column")
			return
		}
	}

	createdCount := 0
	updatedCount := 0
	rowErrors := make([]gin.H, 0)
	for rowIndex, record := range records[1:] {
		csvRowNumber := rowIndex + 2
		row := map[string]string{}
		empty := true
		for index, value := range record {
			header, ok := headers[index]
			if !ok || header == "" {
				continue
			}
			trimmed := strings.TrimSpace(value)
			if trimmed != "" {
				empty = false
			}
			row[header] = trimmed
		}
		if empty {
			continue
		}

		fullName := csvRowValue(row, "full_name", "username", "name")
		email := strings.ToLower(csvRowValue(row, "email", "email_id"))
		if email == "" {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "email is required"})
			continue
		}
		if fullName == "" {
			fullName = fallbackFullNameFromEmail(email)
		}

		existingUser, err := server.fetchUser(`WHERE lower(u.email) = lower($1)`, email)
		create := false
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				create = true
			} else {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				continue
			}
		}

		entityID, err := server.resolveEntityIDFromCSV(csvRowValue(row, "entity_code", "entity", "entity_short_code"), func() string {
			if create {
				return actor.EntityID
			}
			return existingUser.EntityID
		}())
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		deptID, err := server.resolveDepartmentIDFromCSV(csvRowValue(row, "department", "dept", "department_name"), entityID, func() string {
			if create {
				return ""
			}
			return existingUser.DeptID
		}())
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		locationID, err := server.resolveLocationIDFromCSV(csvRowValue(row, "location", "branch", "location_name", "branch_name"), entityID, func() string {
			if create {
				return ""
			}
			return existingUser.LocationID
		}())
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		if err := server.validateEntityLinks(entityID, deptID, locationID); err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		roleValue := csvRowValue(row, "role")
		if roleValue == "" && !create {
			roleValue = existingUser.Role
		}
		roleID, normalizedRole, err := server.resolveRoleIDFromCSV(roleValue)
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		active, err := parseCSVActiveValue(csvRowValue(row, "is_active", "status"), func() bool {
			if create {
				return true
			}
			return existingUser.IsActive
		}())
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		password := csvRowValue(row, "password", "initial_password")
		var passwordHash any = nil
		if password != "" {
			hashBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				continue
			}
			passwordHash = string(hashBytes)
		} else if create {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "password is required for new users"})
			continue
		}

		empSeed := csvRowValue(row, "employee_code", "emp_id", "employee_id", "empoyee_id")
		if empSeed == "" && !create {
			empSeed = existingUser.EmpID
		}
		if empSeed == "" {
			parts := strings.Split(email, "@")
			empSeed = parts[0]
		}
		empID, err := server.nextAvailableEmployeeCode(empSeed, func() string {
			if create {
				return ""
			}
			return existingUser.ID
		}())
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}

		if create {
			var id string
			err = server.db.QueryRow(`
				INSERT INTO users (emp_id, full_name, email, entity_id, dept_id, location_id, role_id, password_hash, is_active)
				VALUES ($1, $2, $3, $4::uuid, NULLIF($5, '')::uuid, NULLIF($6, '')::uuid, $7::uuid, $8, $9)
				RETURNING id
			`, empID, fullName, email, entityID, deptID, locationID, roleID, passwordHash, active).Scan(&id)
			if err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				continue
			}
			_, _ = server.db.Exec(`INSERT INTO user_entity_access (user_id, entity_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`, id, entityID)
			createdCount++
			continue
		}

		_, err = server.db.Exec(`
			UPDATE users
			SET emp_id = $2,
				full_name = $3,
				email = $4,
				entity_id = $5::uuid,
				dept_id = NULLIF($6, '')::uuid,
				location_id = NULLIF($7, '')::uuid,
				role_id = $8::uuid,
				password_hash = COALESCE($9, password_hash),
				is_active = $10,
				updated_at = NOW()
			WHERE id = $1::uuid
		`, existingUser.ID, empID, fullName, email, entityID, deptID, locationID, roleID, passwordHash, active)
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}
		_, _ = server.db.Exec(`INSERT INTO user_entity_access (user_id, entity_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`, existingUser.ID, entityID)
		middleware.TagAudit(c, middleware.AuditMeta{Action: "user_imported", TargetType: "user", TargetID: existingUser.ID, Detail: gin.H{"email": email, "role": normalizedRole, "row": csvRowNumber}})
		updatedCount++
	}

	middleware.TagAudit(c, middleware.AuditMeta{Action: "user_import", TargetType: "user", TargetID: actor.ID, Detail: gin.H{"created": createdCount, "updated": updatedCount, "errors": len(rowErrors), "filename": fileHeader.Filename}})
	httpx.JSON(c, http.StatusOK, gin.H{"created": createdCount, "updated": updatedCount, "errors": rowErrors, "headers": userImportCSVHeaders})
}

func (server *apiServer) getInstallConfig(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	serverURL := strings.TrimSpace(server.config.PublicServerURL)
	if serverURL == "" {
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		serverURL = fmt.Sprintf("%s://%s", scheme, c.Request.Host)
	}

	saltMasterHost := strings.TrimSpace(server.config.SaltMasterHost)
	if saltMasterHost == "" {
		saltMasterHost = c.Request.Host
	}

	wazuhManagerHost := strings.TrimSpace(server.config.WazuhManagerHost)
	if wazuhManagerHost == "" {
		wazuhManagerHost = c.Request.Host
	}

	saltAvailable := false
	if server.salt != nil {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		saltAvailable = server.salt.Available(ctx)
		cancel()
	}

	portalInstallReady := strings.TrimSpace(serverURL) != "" && strings.TrimSpace(server.config.InventoryIngestToken) != ""
	saltBootstrapReady := portalInstallReady && strings.TrimSpace(saltMasterHost) != ""
	sshConfigured := strings.TrimSpace(server.config.SSHTerminalUsername) != "" &&
		(strings.TrimSpace(server.config.SSHTerminalPrivateKeyPath) != "" || strings.TrimSpace(server.config.SSHTerminalPrivateKey) != "") &&
		(!server.config.SSHTerminalStrictHostKey || strings.TrimSpace(server.config.SSHTerminalKnownHostsPath) != "")
	linuxInstallerURL := strings.TrimRight(serverURL, "/") + "/installers/install-itms-agent.sh"
	windowsInstallerURL := strings.TrimRight(serverURL, "/") + "/installers/install-itms-agent.ps1"

	httpx.JSON(c, http.StatusOK, gin.H{
		"publicServerUrl":      serverURL,
		"saltMasterHost":       saltMasterHost,
		"wazuhManagerHost":     wazuhManagerHost,
		"saltApiConfigured":    saltAvailable,
		"saltBootstrapReady":   saltBootstrapReady,
		"sshConfigured":        sshConfigured,
		"wazuhApiConfigured":   server.wazuh != nil && server.wazuh.Enabled(),
		"portalInstallReady":   portalInstallReady,
		"linuxInstallerUrl":    linuxInstallerURL,
		"windowsInstallerUrl":  windowsInstallerURL,
	})
}

func (server *apiServer) getMattermostStatus(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	baseURL := strings.TrimSpace(server.config.MattermostBaseURL)
	teamName := strings.TrimSpace(server.config.MattermostTeam)
	syncDirection := strings.TrimSpace(server.config.MattermostSyncDirection)
	if syncDirection == "" {
		syncDirection = "outbound"
	}
	configured := server.config.MattermostEnabled && baseURL != "" && strings.TrimSpace(server.config.MattermostToken) != "" && teamName != ""
	status := gin.H{
		"enabled":             server.config.MattermostEnabled,
		"configured":          configured,
		"clientReady":         server.mattermost != nil && server.mattermost.Enabled(),
		"bridgeReady":         server.chatBridge != nil && server.chatBridge.Enabled(),
		"baseUrl":             baseURL,
		"team":                teamName,
		"allowedChannelKinds": parseCommaSeparatedValues(server.config.MattermostAllowedChannelKinds),
		"syncDirection":       syncDirection,
		"createChannels":      server.config.MattermostCreateChannels,
		"teamResolved":        false,
	}

	if !configured || server.mattermost == nil || !server.mattermost.Enabled() {
		httpx.JSON(c, http.StatusOK, status)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	team, err := server.mattermost.ResolveTeam(ctx, teamName)
	if err != nil {
		status["lastError"] = err.Error()
		httpx.JSON(c, http.StatusOK, status)
		return
	}

	status["teamResolved"] = true
	status["resolvedTeam"] = gin.H{
		"id":          team.ID,
		"name":        team.Name,
		"displayName": team.DisplayName,
	}
	httpx.JSON(c, http.StatusOK, status)
}

func (server *apiServer) loadAssignedAssets(userID string) ([]gin.H, []gin.H, error) {
	rows, err := server.db.Query(`
		SELECT assets.id, asset_tag, assets.name, category, COALESCE(hostname, ''), COALESCE(serial_number, ''), COALESCE(model, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''), status, is_compute,
			COALESCE(cd.os_name, ''),
			COALESCE(cd.rustdesk_id, ''),
			COALESCE(cd.last_seen::text, ''),
			COALESCE((
				SELECT MAX(h.created_at)::text
				FROM asset_history h
				WHERE h.asset_id = assets.id
				  AND h.action = 'asset_assigned'
			), ''),
			COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''),
			EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = assets.id AND (lower(sw.name) LIKE '%salt-minion%' OR lower(sw.name) LIKE '%salt minion%' OR lower(sw.name) LIKE '%saltstack%')),
			EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = assets.id AND lower(sw.name) LIKE '%wazuh%'),
			EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = assets.id AND (lower(sw.name) LIKE '%openscap%' OR lower(sw.name) LIKE '%scap workbench%' OR lower(sw.name) LIKE '%scap security guide%')),
			EXISTS(SELECT 1 FROM asset_alerts aa WHERE aa.asset_id = assets.id AND lower(aa.source) = 'openscap'),
			EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = assets.id AND (lower(sw.name) LIKE '%clamav%' OR lower(sw.name) LIKE '%clamd%' OR lower(sw.name) LIKE '%freshclam%' OR lower(sw.name) LIKE '%clamwin%'))
		FROM assets
		LEFT JOIN asset_compute_details cd ON cd.asset_id = assets.id
		WHERE assigned_to = $1::uuid ORDER BY is_compute DESC, asset_tag
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	devices := make([]gin.H, 0)
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, assetTag, name, category, hostname, serial, model, cost, warranty, status, osName, rustdeskID, lastSeenAt, assignedAt, saltMinionID, wazuhAgentID string
		var hasSaltSoftware, hasWazuhSoftware, hasOpenSCAPSoftware, hasOpenSCAPReport, hasClamAVSoftware bool
		var compute bool
		if err := rows.Scan(&id, &assetTag, &name, &category, &hostname, &serial, &model, &cost, &warranty, &status, &compute, &osName, &rustdeskID, &lastSeenAt, &assignedAt, &saltMinionID, &wazuhAgentID, &hasSaltSoftware, &hasWazuhSoftware, &hasOpenSCAPSoftware, &hasOpenSCAPReport, &hasClamAVSoftware); err != nil {
			return nil, nil, err
		}
		entry := gin.H{
			"id":                id,
			"asset_tag":         assetTag,
			"assetTag":          assetTag,
			"name":              name,
			"hostname":          emptyToNil(hostname),
			"serial_number":     emptyToNil(serial),
			"serialNumber":      emptyToNil(serial),
			"model":             emptyToNil(model),
			"specs":             emptyToNil(model),
			"cost":              emptyToNil(cost),
			"warranty_until":    emptyToNil(warranty),
			"warrantyExpiresAt": emptyToNil(warranty),
			"rustdeskId":        emptyToNil(rustdeskID),
			"rustdesk_id":       emptyToNil(rustdeskID),
			"lastSeenAt":        emptyToNil(lastSeenAt),
			"assignedAt":        emptyToNil(assignedAt),
			"status":            status,
			"category":          category,
			"osName":            emptyToNil(osName),
			"os_name":           emptyToNil(osName),
			"toolStatus":        buildToolStatus(saltMinionID, nil, wazuhAgentID, hasSaltSoftware, hasWazuhSoftware, hasOpenSCAPSoftware || hasOpenSCAPReport, hasClamAVSoftware),
		}
		if compute {
			devices = append(devices, entry)
			continue
		}
		entry["itemCode"] = assetTag
		entry["item_code"] = assetTag
		items = append(items, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	stockRows, err := server.db.Query(`
		SELECT id, item_code, asset_tag, name, COALESCE(serial_number, ''), COALESCE(specs, ''), COALESCE(warranty_expires_at::text, ''), COALESCE(cost::text, ''), status,
			COALESCE((
				SELECT MAX(a.created_at)::text
				FROM audit_log a
				WHERE a.target_type = 'stock_item'
				  AND a.target_id = stock_items.id
				  AND a.action = 'stock_item_allocated'
			), '')
		FROM stock_items
		WHERE assigned_user_id = $1::uuid
		ORDER BY item_code
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer stockRows.Close()
	for stockRows.Next() {
		var id, itemCode, assetTag, name, serialNumber, specs, warranty, cost, status, assignedAt string
		if err := stockRows.Scan(&id, &itemCode, &assetTag, &name, &serialNumber, &specs, &warranty, &cost, &status, &assignedAt); err != nil {
			return nil, nil, err
		}
		   items = append(items, gin.H{
			   "id":                id,
			   "itemCode":          itemCode,
			   "item_code":         itemCode,
			   "assetTag":          emptyToNil(assetTag),
			   "asset_tag":         emptyToNil(assetTag),
			   "name":              name,
			   "serialNumber":      emptyToNil(serialNumber),
			   "serial_number":     emptyToNil(serialNumber),
			   "specs":             emptyToNil(specs),
			   "warrantyExpiresAt": emptyToNil(warranty),
			   "warranty_until":    emptyToNil(warranty),
			   "cost":              emptyToNil(cost),
			   "assignedAt":        emptyToNil(assignedAt),
			   "status":            status,
		   })
	}
	return devices, items, stockRows.Err()
}

func (server *apiServer) simpleLookup(query string) ([]gin.H, error) {
	rows, err := server.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]gin.H, 0)
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		result = append(result, gin.H{"id": id, "name": name})
	}
	return result, rows.Err()
}

func (server *apiServer) simpleLookupArgs(query string, args ...any) ([]gin.H, error) {
	rows, err := server.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]gin.H, 0)
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		result = append(result, gin.H{"id": id, "name": name})
	}
	return result, rows.Err()
}

func (server *apiServer) listAssets(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	query := `
		SELECT a.id, a.asset_tag, a.name, COALESCE(a.hostname, ''), a.category, a.is_compute, COALESCE(a.serial_number, ''), COALESCE(a.model, ''),
			a.entity_id, e.short_code, COALESCE(a.assigned_to::text, ''), COALESCE(u.full_name, ''), COALESCE(a.dept_id::text, ''), COALESCE(d.name, ''),
			COALESCE(a.location_id::text, ''), COALESCE(l.full_name, ''), COALESCE(a.purchase_date::text, ''), COALESCE(a.cost::text, ''), COALESCE(a.warranty_until::text, ''), COALESCE(a.maintenance_until::text, ''), a.status,
			a.condition, COALESCE(a.glpi_id, 0), COALESCE(a.salt_minion_id, ''), COALESCE(a.wazuh_agent_id, ''), COALESCE(a.notes, '')
		FROM assets a
		JOIN entities e ON e.id = a.entity_id
		LEFT JOIN users u ON u.id = a.assigned_to
		LEFT JOIN departments d ON d.id = a.dept_id
		LEFT JOIN locations l ON l.id = a.location_id
		WHERE ($1 = '' OR a.entity_id = $1::uuid)
		  AND ($2 = '' OR a.dept_id = $2::uuid)
		  AND ($3 = '' OR a.category = $3)
		  AND ($4 = '' OR a.status = $4)
		  AND ($5 = '' OR (CASE WHEN a.assigned_to IS NULL THEN 'false' ELSE 'true' END) = $5)
		ORDER BY a.asset_tag
	`
	rows, err := server.db.Query(query, c.Query("entity"), c.Query("dept"), strings.ToLower(c.Query("category")), strings.ToLower(c.Query("status")), strings.ToLower(c.Query("assigned")))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	result := make([]gin.H, 0)
	for rows.Next() {
		var id, assetTag, name, hostname, category, serial, model, entityRef, entityCode, assignedTo, assignedName, deptRef, deptName, locationRef, locationName, purchaseDate, cost, warrantyUntil, maintenanceUntil, status, condition, saltMinionID, wazuhAgentID, notes string
		var compute bool
		var glpiID int
		if err := rows.Scan(&id, &assetTag, &name, &hostname, &category, &compute, &serial, &model, &entityRef, &entityCode, &assignedTo, &assignedName, &deptRef, &deptName, &locationRef, &locationName, &purchaseDate, &cost, &warrantyUntil, &maintenanceUntil, &status, &condition, &glpiID, &saltMinionID, &wazuhAgentID, &notes); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if !server.entityAllowedByID(c, entityRef) {
			continue
		}
		if middleware.CurrentClaims(c).Role == "employee" && assignedTo != middleware.CurrentClaims(c).UserID {
			continue
		}
		result = append(result, gin.H{"id": id, "asset_tag": assetTag, "name": name, "hostname": emptyToNil(hostname), "category": category, "is_compute": compute, "serial_number": emptyToNil(serial), "model": emptyToNil(model), "entity_id": entityRef, "entity_code": entityCode, "assigned_to": emptyToNil(assignedTo), "assigned_name": emptyToNil(assignedName), "dept_id": emptyToNil(deptRef), "department": emptyToNil(deptName), "location_id": emptyToNil(locationRef), "location": emptyToNil(locationName), "purchase_date": emptyToNil(purchaseDate), "cost": emptyToNil(cost), "warranty_until": emptyToNil(warrantyUntil), "maintenance_until": emptyToNil(maintenanceUntil), "status": status, "condition": condition, "glpi_id": zeroToNil(glpiID), "salt_minion_id": emptyToNil(saltMinionID), "wazuh_agent_id": emptyToNil(wazuhAgentID), "notes": emptyToNil(notes)})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) listDevicesCompat(c *gin.Context) {
	page, pageSize, paginate := parsePaginationRequest(c, 50)
	search := strings.ToLower(strings.TrimSpace(c.Query("search")))
	assignedFilter := strings.ToLower(strings.TrimSpace(c.Query("assigned")))
	lookupValues := c.QueryArray("lookup")
	devices, total, err := server.queryCompatDevices(c, search, assignedFilter, lookupValues, paginate, page, pageSize)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	result := make([]gin.H, 0, len(devices))
	for _, device := range devices {
		result = append(result, server.compatDeviceJSON(device))
	}
	if !paginate {
		httpx.JSON(c, http.StatusOK, result)
		return
	}
	httpx.JSON(c, http.StatusOK, paginatedResponse{Items: result, Total: total, Page: page, PageSize: pageSize})
}

func (server *apiServer) queryCompatDevices(c *gin.Context, search string, assignedFilter string, lookupValues []string, paginate bool, page int, pageSize int) ([]compatDeviceRecord, int, error) {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		return nil, 0, nil
	}
	whereClauses := []string{"a.is_compute = TRUE"}
	args := make([]any, 0, 8)
	argIndex := 1

	if claims.Role == "employee" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.assigned_to = $%d::uuid", argIndex))
		args = append(args, claims.UserID)
		argIndex++
	} else if claims.Role != "super_admin" {
		entityArg := argIndex
		userArg := argIndex + 1
		whereClauses = append(whereClauses, fmt.Sprintf("(a.entity_id = $%d::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $%d::uuid AND uea.entity_id = a.entity_id))", entityArg, userArg))
		args = append(args, claims.EntityID, claims.UserID)
		argIndex += 2
	}

	switch assignedFilter {
	case "assigned":
		whereClauses = append(whereClauses, "a.assigned_to IS NOT NULL")
	case "unassigned":
		whereClauses = append(whereClauses, "a.assigned_to IS NULL")
	}

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("lower(concat_ws(' ', COALESCE(NULLIF(a.hostname, ''), a.asset_tag), a.asset_tag, COALESCE(u.full_name, ''), COALESCE(u.emp_id, ''), COALESCE(d.name, ''), COALESCE(l.full_name, ''))) LIKE $%d", argIndex))
		args = append(args, "%"+search+"%")
		argIndex++
	}

	normalizedLookupValues := make([]string, 0, len(lookupValues))
	for _, lookupValue := range lookupValues {
		lookupValue = strings.ToLower(strings.TrimSpace(lookupValue))
		if lookupValue != "" {
			normalizedLookupValues = append(normalizedLookupValues, lookupValue)
		}
	}
	if len(normalizedLookupValues) > 0 {
		lookupClauses := make([]string, 0, len(normalizedLookupValues))
		for _, lookupValue := range normalizedLookupValues {
			lookupClauses = append(lookupClauses, fmt.Sprintf("lower(a.asset_tag) = $%d OR lower(COALESCE(NULLIF(a.hostname, ''), a.asset_tag)) = $%d", argIndex, argIndex))
			args = append(args, lookupValue)
			argIndex++
		}
		whereClauses = append(whereClauses, "("+strings.Join(lookupClauses, " OR ")+")")
	}

	query := `
		SELECT a.id, a.asset_tag, COALESCE(NULLIF(a.hostname, ''), a.asset_tag), a.category, COALESCE(cd.os_name, ''), COALESCE(cd.gpu, ''), COALESCE(cd.mac_address, ''), COALESCE(cd.last_seen::text, ''), a.status,
			COALESCE(cd.pending_updates, 0), COALESCE(alerts.open_alerts, 0), COALESCE(a.serial_number, ''), COALESCE(a.model, ''),
			COALESCE(a.cost::text, ''), COALESCE(a.warranty_until::text, ''), COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''), COALESCE(u.emp_id, ''),
				COALESCE(d.name, ''), COALESCE(l.full_name, ''), COALESCE(a.assigned_to::text, ''), a.entity_id::text,
				EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = a.id AND (lower(sw.name) LIKE '%wps%' OR lower(sw.name) LIKE '%kingsoft office%')),
				EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = a.id AND (lower(sw.name) LIKE '%libreoffice%' OR lower(sw.name) LIKE '%libre office%')),
				EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = a.id AND (lower(sw.name) LIKE '%chrome%' OR lower(sw.name) LIKE '%google chrome%')),
				EXISTS(SELECT 1 FROM asset_software_inventory sw WHERE sw.asset_id = a.id AND (lower(sw.name) LIKE '%salt-minion%' OR lower(sw.name) LIKE '%salt minion%' OR lower(sw.name) LIKE '%saltstack%'))`
	if paginate {
		query += `, COUNT(*) OVER()`
	}
	query += `
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
		WHERE ` + strings.Join(whereClauses, " AND ") + `
		ORDER BY a.asset_tag`
	if paginate {
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
		args = append(args, pageSize, (page-1)*pageSize)
	}

	rows, err := server.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result := make([]compatDeviceRecord, 0)
	total := 0
	for rows.Next() {
		var pendingUpdates, openAlerts int
		var item compatDeviceRecord
		if paginate {
			if err := rows.Scan(&item.ID, &item.AssetID, &item.Hostname, &item.DeviceType, &item.OSName, &item.GPU, &item.MACAddress, &item.LastSeenAt, &item.Status, &pendingUpdates, &openAlerts, &item.SerialNumber, &item.Model, &item.Cost, &item.WarrantyUntil, &item.UserID, &item.UserFullName, &item.UserEmail, &item.UserEmpID, &item.DepartmentName, &item.BranchName, &item.AssignedTo, &item.EntityID, &item.HasWPS, &item.HasLibreOffice, &item.HasChrome, &item.HasSalt, &total); err != nil {
				return nil, 0, err
			}
		} else {
			if err := rows.Scan(&item.ID, &item.AssetID, &item.Hostname, &item.DeviceType, &item.OSName, &item.GPU, &item.MACAddress, &item.LastSeenAt, &item.Status, &pendingUpdates, &openAlerts, &item.SerialNumber, &item.Model, &item.Cost, &item.WarrantyUntil, &item.UserID, &item.UserFullName, &item.UserEmail, &item.UserEmpID, &item.DepartmentName, &item.BranchName, &item.AssignedTo, &item.EntityID, &item.HasWPS, &item.HasLibreOffice, &item.HasChrome, &item.HasSalt); err != nil {
				return nil, 0, err
			}
		}
		item.PatchStatus = compatPatchStatus(pendingUpdates)
		item.AlertStatus = compatAlertStatus(openAlerts)
		item.ComplianceScore = compatComplianceScore(pendingUpdates, openAlerts)
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if !paginate {
		total = len(result)
	}
	return result, total, nil
}

func (server *apiServer) patchDevicesCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	devices, err := server.loadCompatDevices(c)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	page, pageSize, paginate := parsePaginationRequest(c, 25)
	search := strings.TrimSpace(strings.ToLower(c.Query("search")))
	statusFilter := strings.TrimSpace(strings.ToLower(c.Query("status")))
	departmentFilter := strings.TrimSpace(strings.ToLower(c.Query("department")))

	filtered := make([]int, 0, len(devices))
	for index, device := range devices {
		if statusFilter != "" && strings.ToLower(strings.TrimSpace(device.PatchStatus)) != statusFilter {
			continue
		}
		if departmentFilter != "" && departmentFilter != "all" && strings.ToLower(strings.TrimSpace(device.DepartmentName)) != departmentFilter {
			continue
		}
		if search != "" {
			searchable := strings.ToLower(strings.Join([]string{
				device.Hostname,
				device.OSName,
				device.DepartmentName,
				device.UserFullName,
				device.UserEmail,
				device.UserEmpID,
				device.PatchStatus,
			}, " "))
			if !strings.Contains(searchable, search) {
				continue
			}
		}
		filtered = append(filtered, index)
	}

	patchPriority := func(status string) int {
		switch status {
		case "failed":
			return 0
		case "pending":
			return 1
		case "reboot_pending":
			return 2
		case "up_to_date":
			return 3
		default:
			return 4
		}
	}

	sort.Slice(filtered, func(i, j int) bool {
		left := devices[filtered[i]]
		right := devices[filtered[j]]
		leftPriority := patchPriority(left.PatchStatus)
		rightPriority := patchPriority(right.PatchStatus)
		if leftPriority != rightPriority {
			return leftPriority < rightPriority
		}
		if left.ComplianceScore != right.ComplianceScore {
			return left.ComplianceScore < right.ComplianceScore
		}
		return left.Hostname < right.Hostname
	})

	result := make([]gin.H, 0, len(filtered))
	metrics := gin.H{"total": len(filtered), "upToDate": 0, "pending": 0, "failed": 0, "rebootPending": 0}
	for _, index := range filtered {
		device := devices[index]
		switch device.PatchStatus {
		case "up_to_date":
			metrics["upToDate"] = metrics["upToDate"].(int) + 1
		case "pending":
			metrics["pending"] = metrics["pending"].(int) + 1
		case "failed":
			metrics["failed"] = metrics["failed"].(int) + 1
		case "reboot_pending":
			metrics["rebootPending"] = metrics["rebootPending"].(int) + 1
		}
		result = append(result, gin.H{
			"id":              device.ID,
			"assetId":         device.AssetID,
			"assetTag":        device.AssetID,
			"hostname":        device.Hostname,
			"patchStatus":     device.PatchStatus,
			"complianceScore": device.ComplianceScore,
			"osName":          emptyToNil(device.OSName),
			"lastSeenAt":      emptyToNil(device.LastSeenAt),
			"department":      mapName(device.DepartmentName),
			"user":            mapUser(device.UserFullName, device.UserEmail, device.UserEmpID, device.UserID),
			"installedApps": gin.H{
				"wps":         device.HasWPS,
				"libreOffice": device.HasLibreOffice,
				"chrome":      device.HasChrome,
				"salt":        device.HasSalt,
			},
		})
	}
	if !paginate {
		httpx.JSON(c, http.StatusOK, result)
		return
	}
	start, end := paginationBounds(len(result), page, pageSize)
	httpx.JSON(c, http.StatusOK, gin.H{
		"items":    result[start:end],
		"total":    len(result),
		"page":     page,
		"pageSize": pageSize,
		"summary":  metrics,
	})
}

func (server *apiServer) patchDashboardCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	devices, err := server.loadCompatDevices(c)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	metrics := gin.H{"total": len(devices), "upToDate": 0, "pending": 0, "failed": 0, "rebootPending": 0}
	for _, device := range devices {
		switch device.PatchStatus {
		case "up_to_date":
			metrics["upToDate"] = metrics["upToDate"].(int) + 1
		case "pending":
			metrics["pending"] = metrics["pending"].(int) + 1
		case "failed":
			metrics["failed"] = metrics["failed"].(int) + 1
		case "reboot_pending":
			metrics["rebootPending"] = metrics["rebootPending"].(int) + 1
		}
	}
	httpx.JSON(c, http.StatusOK, metrics)
}

func (server *apiServer) patchJobsCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	rows, err := server.db.Query(`
		SELECT h.id, COALESCE(a.hostname, a.asset_tag), h.detail, h.created_at
		FROM asset_history h
		JOIN assets a ON a.id = h.asset_id
		WHERE h.action = 'patch_run'
		ORDER BY h.created_at DESC
		LIMIT 20
	`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, scope string
		var detailRaw []byte
		var createdAt time.Time
		if err := rows.Scan(&id, &scope, &detailRaw, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		var detail map[string]any
		_ = json.Unmarshal(detailRaw, &detail)
		items = append(items, gin.H{"id": id, "jid": id, "status": patchRunStatus(detail), "scope": scope, "createdAt": createdAt, "updatedAt": createdAt})
	}
	httpx.JSON(c, http.StatusOK, items)
}

func (server *apiServer) patchRunCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		Scope   string `json:"scope"`
		Action  string `json:"action"`
		State   string `json:"state"`
		Command string `json:"command"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid patch payload")
		return
	}
	var assetID string
	err := server.db.QueryRow(`
		SELECT id FROM assets
		WHERE is_compute = TRUE AND (hostname = $1 OR salt_minion_id = $1 OR asset_tag = $1)
		LIMIT 1
	`, strings.TrimSpace(input.Scope)).Scan(&assetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "device not found for patch scope")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	asset, err := server.fetchAsset(assetID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "device not found for patch scope")
		return
	}
	result, err := server.queuePatchRun(c, asset, input.Action, input.State, input.Command)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "patch_run", TargetType: "asset", TargetID: asset.ID, Detail: result})
	httpx.JSON(c, http.StatusOK, result)
}

type patchRunReportRowInput struct {
	DeviceID      string                       `json:"deviceId"`
	Hostname      string                       `json:"hostname"`
	Department    string                       `json:"department"`
	Status        string                       `json:"status"`
	PatchStatus   string                       `json:"patchStatus"`
	Target        string                       `json:"target"`
	Action        string                       `json:"action"`
	Message       string                       `json:"message"`
	UpdatedItems  []string                     `json:"updatedItems"`
	PackageChanges []patchRunReportPackageChangeInput `json:"packageChanges"`
}

type patchRunReportPackageChangeInput struct {
	Name        string `json:"name"`
	FromVersion string `json:"fromVersion"`
	ToVersion   string `json:"toVersion"`
}

type patchRunReportInput struct {
	ID           string                   `json:"id,omitempty"`
	ScopeLabel   string                   `json:"scopeLabel"`
	RequestedAt  string                   `json:"requestedAt"`
	CompletedAt  string                   `json:"completedAt"`
	SuccessCount int                      `json:"successCount"`
	FailedCount  int                      `json:"failedCount"`
	Rows         []patchRunReportRowInput `json:"rows"`
}

func (server *apiServer) createPatchRunReport(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input patchRunReportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid patch report payload")
		return
	}
	input.ScopeLabel = strings.TrimSpace(input.ScopeLabel)
	if input.ScopeLabel == "" || len(input.Rows) == 0 {
		httpx.Error(c, http.StatusBadRequest, "patch report requires a scope and at least one row")
		return
	}
	requestedAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.RequestedAt))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid patch report requestedAt")
		return
	}
	completedAt, err := time.Parse(time.RFC3339, strings.TrimSpace(input.CompletedAt))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid patch report completedAt")
		return
	}

	entitySet := make(map[string]struct{})
	successCount := 0
	for index := range input.Rows {
		row := &input.Rows[index]
		row.DeviceID = strings.TrimSpace(row.DeviceID)
		if row.DeviceID == "" {
			httpx.Error(c, http.StatusBadRequest, "patch report rows require device IDs")
			return
		}
		asset, err := server.fetchAsset(row.DeviceID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				httpx.Error(c, http.StatusBadRequest, "patch report contains an unknown asset")
				return
			}
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if !server.entityAllowedByID(c, asset.EntityID) {
			httpx.Error(c, http.StatusForbidden, "forbidden")
			return
		}
		entitySet[asset.EntityID] = struct{}{}
		if strings.EqualFold(strings.TrimSpace(row.Status), "success") {
			successCount++
		}
	}

	entityIDs := make([]string, 0, len(entitySet))
	for entityID := range entitySet {
		entityIDs = append(entityIDs, entityID)
	}
	sort.Strings(entityIDs)
	input.SuccessCount = successCount
	input.FailedCount = len(input.Rows) - successCount
	payload, _ := json.Marshal(input)
	entityPayload, _ := json.Marshal(entityIDs)
	actorID := ""
	if claims := middleware.CurrentClaims(c); claims != nil {
		actorID = claims.UserID
	}

	var id string
	err = server.db.QueryRow(`
		INSERT INTO patch_run_reports (
			actor_id,
			scope_label,
			requested_at,
			completed_at,
			success_count,
			failed_count,
			row_count,
			entity_ids,
			report
		) VALUES (
			NULLIF($1, '')::uuid,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8::jsonb,
			$9::jsonb
		)
		RETURNING id::text
	`, actorID, input.ScopeLabel, requestedAt, completedAt, input.SuccessCount, input.FailedCount, len(input.Rows), string(entityPayload), string(payload)).Scan(&id)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	input.ID = id
	httpx.JSON(c, http.StatusCreated, input)
}

func (server *apiServer) listPatchRunReports(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	limit := parseRecentItemsLimit(c.Query("limit"), 50)
	rows, err := server.db.Query(fmt.Sprintf(`
		SELECT r.id::text, r.scope_label, r.requested_at, r.completed_at, r.success_count, r.failed_count, r.row_count, r.entity_ids, r.report, COALESCE(u.full_name, '')
		FROM patch_run_reports r
		LEFT JOIN users u ON u.id = r.actor_id
		ORDER BY r.created_at DESC
		LIMIT %d
	`, limit))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, scopeLabel, requestedBy string
		var entityIDsRaw, reportRaw []byte
		var requestedAt, completedAt time.Time
		var successCount, failedCount, rowCount int
		if err := rows.Scan(&id, &scopeLabel, &requestedAt, &completedAt, &successCount, &failedCount, &rowCount, &entityIDsRaw, &reportRaw, &requestedBy); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if !server.patchRunReportAllowed(c, entityIDsRaw) {
			continue
		}
		departments := extractPatchRunReportDepartments(reportRaw)
		items = append(items, gin.H{
			"id":           id,
			"scopeLabel":   scopeLabel,
			"requestedAt":  requestedAt,
			"completedAt":  completedAt,
			"successCount": successCount,
			"failedCount":  failedCount,
			"rowCount":     rowCount,
			"departments":  departments,
			"requestedBy":  emptyToNil(requestedBy),
		})
	}
	httpx.JSON(c, http.StatusOK, items)
}

func (server *apiServer) getPatchRunReport(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var reportRaw []byte
	var entityIDsRaw []byte
	err := server.db.QueryRow(`SELECT report, entity_ids FROM patch_run_reports WHERE id = $1::uuid`, c.Param("id")).Scan(&reportRaw, &entityIDsRaw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "patch report not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.patchRunReportAllowed(c, entityIDsRaw) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	var report map[string]any
	if err := json.Unmarshal(reportRaw, &report); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	report["id"] = c.Param("id")
	httpx.JSON(c, http.StatusOK, report)
}

func (server *apiServer) patchRunReportAllowed(c *gin.Context, entityIDsRaw []byte) bool {
	var entityIDs []string
	if err := json.Unmarshal(entityIDsRaw, &entityIDs); err != nil {
		return false
	}
	if len(entityIDs) == 0 {
		return false
	}
	for _, entityID := range entityIDs {
		if !server.entityAllowedByID(c, entityID) {
			return false
		}
	}
	return true
}

func extractPatchRunReportDepartments(reportRaw []byte) []string {
	var report struct {
		Rows []struct {
			Department string `json:"department"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(reportRaw, &report); err != nil {
		return []string{}
	}
	seen := make(map[string]struct{})
	departments := make([]string, 0)
	for _, row := range report.Rows {
		department := strings.TrimSpace(row.Department)
		if department == "" {
			department = "Unassigned"
		}
		if _, exists := seen[department]; exists {
			continue
		}
		seen[department] = struct{}{}
		departments = append(departments, department)
	}
	sort.Strings(departments)
	return departments
}

func (server *apiServer) listTerminalSessionsCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	deviceID := c.Query("deviceId")
	asset, err := server.fetchAsset(strings.TrimSpace(deviceID))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	rows, err := server.db.Query(`
		SELECT h.id, h.created_at, COALESCE(u.full_name, '')
		FROM asset_history h
		LEFT JOIN users u ON u.id = h.actor_id
		WHERE h.asset_id = $1::uuid AND h.action = 'terminal_session'
		ORDER BY h.created_at DESC
		LIMIT 20
	`, deviceID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, requestedBy string
		var createdAt time.Time
		if err := rows.Scan(&id, &createdAt, &requestedBy); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		items = append(items, gin.H{"id": id, "deviceId": deviceID, "status": "started", "createdAt": createdAt, "requestedBy": emptyToNil(requestedBy)})
	}
	httpx.JSON(c, http.StatusOK, items)
}

func (server *apiServer) createTerminalSessionCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		DeviceID string `json:"deviceId"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid terminal payload")
		return
	}
	asset, err := server.fetchAsset(input.DeviceID)
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	terminalPayload, err := server.buildTerminalPayload(asset)
	if err != nil {
		server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "terminal", "high", "Terminal session unavailable", err.Error())
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	_, _ = server.recordAssetHistory(asset.ID, middleware.CurrentClaims(c).UserID, "terminal_session", terminalPayload)
	middleware.TagAudit(c, middleware.AuditMeta{Action: "terminal_session", TargetType: "asset", TargetID: asset.ID, Detail: terminalPayload})
	httpx.JSON(c, http.StatusOK, gin.H{"id": asset.ID, "deviceId": asset.ID, "status": "started", "createdAt": time.Now().UTC(), "requestedBy": middleware.CurrentClaims(c).Name, "connection": terminalPayload})
}

func (server *apiServer) getTerminalTarget(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	minionID := strings.TrimSpace(c.Param("minionId"))
	if minionID == "" {
		httpx.Error(c, http.StatusBadRequest, "terminal target is required")
		return
	}
	asset, err := server.fetchAssetByTerminalTarget(minionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "terminal target not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "terminal target not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "terminal is only available for compute assets")
		return
	}
	target := coalesceString(asset.SaltMinionID, coalesceString(asset.Hostname, asset.AssetTag))
	connected := false
	if server.salt != nil && server.salt.Enabled() {
		connected, err = server.salt.TargetConnected(c.Request.Context(), target)
		if err != nil {
			httpx.Error(c, http.StatusBadGateway, err.Error())
			return
		}
	}
	hostname := strings.TrimSpace(asset.Hostname)
	if hostname == "" {
		hostname = strings.TrimSpace(asset.AssetTag)
	}
	if hostname == "" {
		hostname = minionID
	}
	departmentName := ""
	if strings.TrimSpace(asset.DeptID) != "" {
		_ = server.db.QueryRow(`SELECT COALESCE(name, '') FROM departments WHERE id = $1::uuid`, asset.DeptID).Scan(&departmentName)
	}
	locationName := ""
	if strings.TrimSpace(asset.LocationID) != "" {
		_ = server.db.QueryRow(`SELECT COALESCE(full_name, '') FROM locations WHERE id = $1::uuid`, asset.LocationID).Scan(&locationName)
	}
	httpx.JSON(c, http.StatusOK, gin.H{
		"assetId":        asset.ID,
		"assetName":      emptyToNil(strings.TrimSpace(asset.Name)),
		"hostname":       hostname,
		"assetTag":       asset.AssetTag,
		"departmentName": emptyToNil(strings.TrimSpace(departmentName)),
		"locationName":   emptyToNil(strings.TrimSpace(locationName)),
		"minionId":       target,
		"connected":      connected,
		"policy":    terminalPolicyPayload(),
	})
}

func (server *apiServer) executeTerminalCommand(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if server.salt == nil || !server.salt.Enabled() {
		httpx.Error(c, http.StatusBadGateway, "saltstack integration is not configured")
		return
	}
	minionID := strings.TrimSpace(c.Param("minionId"))
	if minionID == "" {
		httpx.Error(c, http.StatusBadRequest, "terminal target is required")
		return
	}
	var input struct {
		Command string `json:"command"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid terminal command payload")
		return
	}
	command := strings.TrimSpace(input.Command)
	if command == "" {
		httpx.Error(c, http.StatusBadRequest, "command is required")
		return
	}
	commandMode, normalizedCommand, err := parseTerminalCommand(command)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	asset, err := server.fetchAssetByTerminalTarget(minionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "terminal target not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "terminal target not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "terminal is only available for compute assets")
		return
	}
	target := coalesceString(asset.SaltMinionID, coalesceString(asset.Hostname, asset.AssetTag))
	hostname := strings.TrimSpace(asset.Hostname)
	if hostname == "" {
		hostname = strings.TrimSpace(asset.AssetTag)
	}
	if hostname == "" {
		hostname = target
	}
	var policyErr error
	if commandMode == terminalCommandModeState {
		policyErr = terminalStatePolicy(normalizedCommand)
	} else {
		policyErr = terminalCommandPolicy(normalizedCommand)
	}
	if policyErr != nil {
		detail := gin.H{"minionId": target, "hostname": hostname, "command": command, "normalizedCommand": normalizedCommand, "policy": policyErr.Error()}
		detail["mode"] = string(commandMode)
		_ = server.recordAuditLog(c, middleware.AuditMeta{Action: "terminal_command_blocked", TargetType: "asset", TargetID: asset.ID, Detail: detail})
		_, _ = server.recordAssetHistory(asset.ID, claims.UserID, "terminal_command_blocked", detail)
		httpx.Error(c, http.StatusBadRequest, policyErr.Error())
		return
	}
	connected, err := server.salt.TargetConnected(c.Request.Context(), target)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	if !connected {
		httpx.Error(c, http.StatusBadGateway, "salt minion is not connected to the master for this asset")
		return
	}
	var output map[string]any
	if commandMode == terminalCommandModeState {
		output, err = server.salt.RunState(c.Request.Context(), target, normalizedCommand)
	} else {
		output, err = server.salt.RunCommand(c.Request.Context(), target, normalizedCommand)
	}
	if err != nil {
		server.recordOperationalAlert(asset, claims.UserID, "terminal", "high", "Terminal command failed", err.Error())
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	stdout := ""
	stderr := ""
	retcode := any(0)
	if commandMode == terminalCommandModeState {
		formatted, marshalErr := json.MarshalIndent(output, "", "  ")
		if marshalErr != nil {
			stdout = strings.TrimSpace(fmt.Sprint(output))
		} else {
			stdout = strings.TrimSpace(string(formatted))
		}
	} else {
		stdout = strings.TrimRight(fmt.Sprint(output["stdout"]), "\n")
		stderr = strings.TrimRight(fmt.Sprint(output["stderr"]), "\n")
		if stdout == "<nil>" {
			stdout = ""
		}
		if stderr == "<nil>" {
			stderr = ""
		}
		retcode = output["retcode"]
	}
	auditDetail := gin.H{
		"minionId":          target,
		"hostname":          hostname,
		"command":           command,
		"normalizedCommand": normalizedCommand,
		"mode":              string(commandMode),
		"retcode":           retcode,
		"stdoutBytes":       len(stdout),
		"stderrBytes":       len(stderr),
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "terminal_command_executed", TargetType: "asset", TargetID: asset.ID, Detail: auditDetail})
	_, _ = server.recordAssetHistory(asset.ID, claims.UserID, "terminal_command", auditDetail)
	httpx.JSON(c, http.StatusOK, gin.H{
		"command": normalizedCommand,
		"mode":    string(commandMode),
		"stdout":  stdout,
		"stderr":  stderr,
		"retcode": retcode,
	})
}

func (server *apiServer) executeTerminalFunction(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if server.salt == nil || !server.salt.Enabled() {
		httpx.Error(c, http.StatusBadGateway, "saltstack integration is not configured")
		return
	}
	minionID := strings.TrimSpace(c.Param("minionId"))
	if minionID == "" {
		httpx.Error(c, http.StatusBadRequest, "terminal target is required")
		return
	}
	var input struct {
		Client    string   `json:"client"`
		Function  string   `json:"function"`
		Arguments []string `json:"arguments"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid terminal function payload")
		return
	}
	if clientName := strings.TrimSpace(strings.ToLower(input.Client)); clientName != "" && clientName != "local" {
		httpx.Error(c, http.StatusBadRequest, "only the local Salt client is allowed")
		return
	}
	functionName := strings.TrimSpace(input.Function)
	if functionName == "" {
		httpx.Error(c, http.StatusBadRequest, "function is required")
		return
	}
	asset, err := server.fetchAssetByTerminalTarget(minionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "terminal target not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "terminal target not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "terminal is only available for compute assets")
		return
	}
	target := coalesceString(asset.SaltMinionID, coalesceString(asset.Hostname, asset.AssetTag))
	hostname := strings.TrimSpace(asset.Hostname)
	if hostname == "" {
		hostname = strings.TrimSpace(asset.AssetTag)
	}
	if hostname == "" {
		hostname = target
	}
	if policyErr := terminalFunctionPolicy(functionName, input.Arguments); policyErr != nil {
		detail := gin.H{"minionId": target, "hostname": hostname, "function": functionName, "arguments": input.Arguments, "policy": policyErr.Error()}
		_ = server.recordAuditLog(c, middleware.AuditMeta{Action: "terminal_function_blocked", TargetType: "asset", TargetID: asset.ID, Detail: detail})
		_, _ = server.recordAssetHistory(asset.ID, claims.UserID, "terminal_function_blocked", detail)
		httpx.Error(c, http.StatusBadRequest, policyErr.Error())
		return
	}
	connected, err := server.salt.TargetConnected(c.Request.Context(), target)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	if !connected {
		httpx.Error(c, http.StatusBadGateway, "salt minion is not connected to the master for this asset")
		return
	}

	normalizedFunction := strings.ToLower(strings.TrimSpace(functionName))
	trimmedArgs := make([]string, 0, len(input.Arguments))
	for _, arg := range input.Arguments {
		trimmed := strings.TrimSpace(arg)
		if trimmed != "" {
			trimmedArgs = append(trimmedArgs, trimmed)
		}
	}

	stdout := ""
	stderr := ""
	retcode := any(0)
	mode := "function"

	switch normalizedFunction {
	case "state", "state.apply", "state.sls":
		mode = string(terminalCommandModeState)
		output, runErr := server.salt.RunNamedState(c.Request.Context(), target, normalizedFunction, trimmedArgs[0])
		if runErr != nil {
			server.recordOperationalAlert(asset, claims.UserID, "terminal", "high", "Terminal function failed", runErr.Error())
			httpx.Error(c, http.StatusBadGateway, runErr.Error())
			return
		}
		formatted, marshalErr := json.MarshalIndent(output, "", "  ")
		if marshalErr != nil {
			stdout = strings.TrimSpace(fmt.Sprint(output))
		} else {
			stdout = strings.TrimSpace(string(formatted))
		}
	case "cmd.run", "cmd.run_all", "cmd.script":
		mode = string(terminalCommandModeShell)
		output, runErr := server.salt.RunCommand(c.Request.Context(), target, strings.Join(trimmedArgs, " "))
		if runErr != nil {
			server.recordOperationalAlert(asset, claims.UserID, "terminal", "high", "Terminal function failed", runErr.Error())
			httpx.Error(c, http.StatusBadGateway, runErr.Error())
			return
		}
		stdout = strings.TrimRight(fmt.Sprint(output["stdout"]), "\n")
		stderr = strings.TrimRight(fmt.Sprint(output["stderr"]), "\n")
		if stdout == "<nil>" {
			stdout = ""
		}
		if stderr == "<nil>" {
			stderr = ""
		}
		retcode = output["retcode"]
	default:
		output, runErr := server.salt.RunFunction(c.Request.Context(), target, normalizedFunction, trimmedArgs)
		if runErr != nil {
			server.recordOperationalAlert(asset, claims.UserID, "terminal", "high", "Terminal function failed", runErr.Error())
			httpx.Error(c, http.StatusBadGateway, runErr.Error())
			return
		}
		formatted, marshalErr := json.MarshalIndent(output, "", "  ")
		if marshalErr != nil {
			stdout = strings.TrimSpace(fmt.Sprint(output))
		} else {
			stdout = strings.TrimSpace(string(formatted))
		}
	}

	auditDetail := gin.H{
		"minionId":    target,
		"hostname":    hostname,
		"function":    normalizedFunction,
		"arguments":   trimmedArgs,
		"mode":        mode,
		"retcode":     retcode,
		"stdoutBytes": len(stdout),
		"stderrBytes": len(stderr),
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "terminal_function_executed", TargetType: "asset", TargetID: asset.ID, Detail: auditDetail})
	_, _ = server.recordAssetHistory(asset.ID, claims.UserID, "terminal_function", auditDetail)
	httpx.JSON(c, http.StatusOK, gin.H{
		"client":    "local",
		"function":  normalizedFunction,
		"arguments": trimmedArgs,
		"mode":      mode,
		"stdout":    stdout,
		"stderr":    stderr,
		"retcode":   retcode,
	})
}

func (server *apiServer) loadCompatDevices(c *gin.Context) ([]compatDeviceRecord, error) {
	rows, err := server.db.Query(`
		SELECT a.id, a.asset_tag, COALESCE(NULLIF(a.hostname, ''), a.asset_tag), a.category, COALESCE(cd.os_name, ''), COALESCE(cd.last_seen::text, ''), a.status,
			COALESCE(cd.pending_updates, 0), COALESCE(alerts.open_alerts, 0), COALESCE(a.serial_number, ''), COALESCE(a.model, ''),
			COALESCE(a.warranty_until::text, ''), COALESCE(u.id::text, ''), COALESCE(u.full_name, ''), COALESCE(u.email, ''), COALESCE(u.emp_id, ''),
			COALESCE(ad.name, ud.name, ''), COALESCE(l.full_name, ''), COALESCE(a.assigned_to::text, ''), a.entity_id::text
		FROM assets a
		LEFT JOIN asset_compute_details cd ON cd.asset_id = a.id
		LEFT JOIN users u ON u.id = a.assigned_to
		LEFT JOIN departments ad ON ad.id = a.dept_id
		LEFT JOIN departments ud ON ud.id = u.dept_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN (
			SELECT asset_id, COUNT(*) AS open_alerts
			FROM asset_alerts
			WHERE is_resolved = FALSE
			GROUP BY asset_id
		) alerts ON alerts.asset_id = a.id
		WHERE a.is_compute = TRUE
		ORDER BY a.asset_tag
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]compatDeviceRecord, 0)
	for rows.Next() {
		var pendingUpdates, openAlerts int
		var item compatDeviceRecord
		if err := rows.Scan(&item.ID, &item.AssetID, &item.Hostname, &item.DeviceType, &item.OSName, &item.LastSeenAt, &item.Status, &pendingUpdates, &openAlerts, &item.SerialNumber, &item.Model, &item.WarrantyUntil, &item.UserID, &item.UserFullName, &item.UserEmail, &item.UserEmpID, &item.DepartmentName, &item.BranchName, &item.AssignedTo, &item.EntityID); err != nil {
			return nil, err
		}
		if !server.entityAllowedByID(c, item.EntityID) {
			continue
		}
		claims := middleware.CurrentClaims(c)
		if claims != nil && claims.Role == "employee" && item.AssignedTo != claims.UserID {
			continue
		}
		item.PatchStatus = compatPatchStatus(pendingUpdates)
		item.AlertStatus = compatAlertStatus(openAlerts)
		item.ComplianceScore = compatComplianceScore(pendingUpdates, openAlerts)
		result = append(result, item)
	}
	return result, rows.Err()
}

func (server *apiServer) compatDeviceJSON(device compatDeviceRecord) gin.H {
	return gin.H{
		"id":                device.ID,
		"assetId":           device.AssetID,
		"hostname":          device.Hostname,
		"deviceType":        device.DeviceType,
		"osName":            emptyToNil(device.OSName),
		"gpu":               emptyToNil(device.GPU),
		"macAddress":        emptyToNil(device.MACAddress),
		"lastSeenAt":        emptyToNil(device.LastSeenAt),
		"patchStatus":       device.PatchStatus,
		"alertStatus":       device.AlertStatus,
		"status":            device.Status,
		"serialNumber":      emptyToNil(device.SerialNumber),
		"model":             emptyToNil(device.Model),
		"cost":              emptyToNil(device.Cost),
		"warrantyUntil":     emptyToNil(device.WarrantyUntil),
		"warrantyExpiresAt": emptyToNil(device.WarrantyUntil),
		"user":              mapUser(device.UserFullName, device.UserEmail, device.UserEmpID, device.UserID),
		"branch":            mapName(device.BranchName),
		"department":        mapName(device.DepartmentName),
	}
}

func (server *apiServer) getInventorySyncStatus(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	if server.sync == nil {
		httpx.JSON(c, http.StatusOK, gin.H{"enabled": false, "configured": false, "sourceType": "json", "interval": "24h", "running": false})
		return
	}
	status, err := server.sync.Status(c.Request.Context())
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, status)
}

func (server *apiServer) runInventorySync(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	if server.sync == nil {
		httpx.Error(c, http.StatusBadRequest, "inventory sync service is not available")
		return
	}
	status, err := server.sync.RunOnce(c.Request.Context())
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already running") {
			httpx.Error(c, http.StatusConflict, err.Error())
			return
		}
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, status)
}

func (server *apiServer) ingestInventorySnapshot(c *gin.Context) {
	if server.sync == nil {
		httpx.Error(c, http.StatusBadRequest, "inventory sync service is not available")
		return
	}

	expectedToken := server.sync.IngestToken()
	if expectedToken == "" {
		httpx.Error(c, http.StatusServiceUnavailable, "inventory ingest token is not configured")
		return
	}

	receivedToken := strings.TrimSpace(c.GetHeader("X-Inventory-Token"))
	if receivedToken == "" {
		authorization := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
			receivedToken = strings.TrimSpace(authorization[7:])
		}
	}
	if receivedToken == "" || receivedToken != expectedToken {
		httpx.Error(c, http.StatusUnauthorized, "invalid inventory ingest token")
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxInventoryIngestBytes)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "failed to read inventory payload or payload exceeds 8 MB")
		return
	}
	assets, err := server.sync.DecodePayload(body)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(assets) == 0 {
		httpx.Error(c, http.StatusBadRequest, "inventory payload must include at least one asset")
		return
	}
	if len(assets) > maxInventoryIngestAssets {
		httpx.Error(c, http.StatusBadRequest, "inventory payload includes too many assets")
		return
	}

	status, err := server.sync.Ingest(c.Request.Context(), assets)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	for _, asset := range assets {
		if server.salt != nil {
			target := strings.TrimSpace(asset.SaltMinionID)
			if target != "" {
				if err := server.salt.AcceptMinionKey(c.Request.Context(), target); err != nil {
					log.Printf("inventory salt key accept skipped for %s: %v", target, err)
				}
			}
		}
		if err := server.ensureInventoryEnrollmentRequest(c.Request.Context(), asset); err != nil {
			log.Printf("inventory enrollment request skipped for %s: %v", strings.TrimSpace(asset.AssetTag), err)
		}
		if err := server.completeInventoryEnrollmentRequest(c.Request.Context(), asset); err != nil {
			log.Printf("inventory enrollment request completion skipped for %s: %v", strings.TrimSpace(asset.AssetTag), err)
		}
		if err := server.persistInventorySecurityReports(c.Request.Context(), asset); err != nil {
			log.Printf("inventory security report ingest skipped for %s: %v", strings.TrimSpace(asset.AssetTag), err)
		}
		if err := server.persistInventoryWazuhFindings(c.Request.Context(), asset); err != nil {
			log.Printf("inventory wazuh finding ingest skipped for %s: %v", strings.TrimSpace(asset.AssetTag), err)
		}
	}
	httpx.JSON(c, http.StatusAccepted, status)
}

func (server *apiServer) ingestBackupStatus(c *gin.Context) {
	expectedToken := strings.TrimSpace(server.config.InventoryIngestToken)
	if expectedToken == "" {
		httpx.Error(c, http.StatusServiceUnavailable, "backup ingest token is not configured")
		return
	}

	receivedToken := strings.TrimSpace(c.GetHeader("X-Inventory-Token"))
	if receivedToken == "" {
		authorization := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
			receivedToken = strings.TrimSpace(authorization[7:])
		}
	}
	if receivedToken == "" || receivedToken != expectedToken {
		httpx.Error(c, http.StatusUnauthorized, "invalid backup ingest token")
		return
	}

	var body struct {
		AssetTag        string  `json:"asset_tag"`
		BackupType      string  `json:"backup_type"`
		Status          string  `json:"status"`
		StartedAt       *string `json:"started_at"`
		LastBackupAt    *string `json:"last_backup_at"`
		BackupSizeBytes *int64  `json:"backup_size_bytes"`
		Target          string  `json:"target"`
		ErrorMessage    string  `json:"error_message"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	assetTag := strings.TrimSpace(body.AssetTag)
	if assetTag == "" {
		httpx.Error(c, http.StatusBadRequest, "asset_tag is required")
		return
	}

	var assetID string
	err := server.db.QueryRow(`SELECT id FROM assets WHERE asset_tag = $1`, assetTag).Scan(&assetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	backupType := strings.TrimSpace(body.BackupType)
	if backupType == "" {
		backupType = "full"
	}

	status := strings.TrimSpace(body.Status)
	if status == "" {
		status = "completed"
	}

	startedAt := "NOW()"
	if body.StartedAt != nil && strings.TrimSpace(*body.StartedAt) != "" {
		startedAt = "$4"
	}

	var completedAt interface{}
	if body.LastBackupAt != nil && strings.TrimSpace(*body.LastBackupAt) != "" {
		completedAt = strings.TrimSpace(*body.LastBackupAt)
	}

	backupLocation := strings.TrimSpace(body.Target)
	errorMsg := strings.TrimSpace(body.ErrorMessage)

	query := fmt.Sprintf(`
		INSERT INTO backup_status 
		(asset_id, backup_type, status, started_at, completed_at, size_bytes, backup_location, error_message)
		VALUES ($1::uuid, $2, $3, %s, $5, $6, $7, $8)
	`, startedAt)

	args := []interface{}{assetID, backupType, status}
	if startedAt == "$4" {
		args = append(args, strings.TrimSpace(*body.StartedAt))
	}
	args = append(args, completedAt, body.BackupSizeBytes, backupLocation, errorMsg)

	_, err = server.db.Exec(query, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(c, http.StatusAccepted, gin.H{
		"status":    "accepted",
		"asset_tag": assetTag,
		"asset_id":  assetID,
	})
}

func (server *apiServer) heartbeat(c *gin.Context) {
	expectedToken := strings.TrimSpace(server.config.InventoryIngestToken)
	if expectedToken == "" {
		httpx.Error(c, http.StatusServiceUnavailable, "heartbeat token is not configured")
		return
	}

	receivedToken := strings.TrimSpace(c.GetHeader("X-Inventory-Token"))
	if receivedToken == "" {
		authorization := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
			receivedToken = strings.TrimSpace(authorization[7:])
		}
	}
	if receivedToken == "" || receivedToken != expectedToken {
		httpx.Error(c, http.StatusUnauthorized, "invalid heartbeat token")
		return
	}

	var body struct {
		AssetTag string `json:"asset_tag"`
		Hostname string `json:"hostname"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	assetTag := strings.TrimSpace(body.AssetTag)
	if assetTag == "" {
		httpx.Error(c, http.StatusBadRequest, "asset_tag is required")
		return
	}

	var assetID string
	err := server.db.QueryRow(`SELECT id FROM assets WHERE asset_tag = $1`, assetTag).Scan(&assetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	_, err = server.db.Exec(`
		UPDATE asset_compute_details 
		SET last_seen = NOW() 
		WHERE asset_id = $1::uuid
	`, assetID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"status":    "ok",
		"asset_tag": assetTag,
		"asset_id":  assetID,
		"timestamp": "NOW()",
	})
}

func (server *apiServer) ensureInventoryEnrollmentRequest(ctx context.Context, asset inventorysync.Asset) error {
	email := strings.TrimSpace(asset.AssignedToEmail)
	name := strings.TrimSpace(asset.AssignedToName)
	empID := strings.TrimSpace(asset.EmployeeCode)
	department := strings.TrimSpace(asset.DepartmentName)
	if email == "" && name == "" && empID == "" && department == "" {
		return nil
	}

	requesterID, err := server.inventoryEnrollmentRequesterID(ctx)
	if err != nil {
		return err
	}

	assetRef := inventoryEnrollmentAssetRef(asset)
	referenceKey := inventoryEnrollmentReferenceKey(assetRef)
	title := fmt.Sprintf("Device enrollment review for %s", assetRef)

	description := strings.Join([]string{
		"A new endpoint pushed inventory and is requesting enrollment review.",
		fmt.Sprintf("Asset tag / host: %s", fallbackString(assetRef, "Unknown")),
		fmt.Sprintf("Requester name: %s", fallbackString(name, "Not provided")),
		fmt.Sprintf("Requester email: %s", fallbackString(email, "Not provided")),
		fmt.Sprintf("Employee ID: %s", fallbackString(empID, "Not provided")),
		fmt.Sprintf("Department: %s", fallbackString(department, "Not provided")),
		fmt.Sprintf("Category: %s", fallbackString(strings.TrimSpace(asset.Category), "Not provided")),
		fmt.Sprintf("Model: %s", fallbackString(strings.TrimSpace(asset.Model), "Not provided")),
		fmt.Sprintf("OS: %s", fallbackString(func() string {
			if asset.ComputeDetails == nil {
				return ""
			}
			return strings.TrimSpace(asset.ComputeDetails.OSName)
		}(), "Not provided")),
	}, "\n")
	waitingNote := fmt.Sprintf("Awaiting superadmin/IT review before endpoint onboarding is acknowledged for %s.", assetRef)

	assignedName, assignedEmpID, assigned, err := server.lookupInventoryAssignedUser(ctx, asset)
	if err != nil {
		return err
	}

	existingID, existingStatus, err := server.lookupInventoryEnrollmentRequest(ctx, requesterID, referenceKey, title)
	if err != nil {
		return err
	}
	if existingID != "" {
		switch existingStatus {
		case "pending", "in_progress":
			_, err = server.db.ExecContext(ctx, `
				UPDATE requests
				SET description = $2,
					reference_key = NULLIF($3, ''),
					updated_at = NOW()
				WHERE id = $1::uuid
			`, existingID, description, referenceKey)
			return err
		case "resolved", "rejected":
			if assigned {
				return nil
			}

			reopenNote := fmt.Sprintf("Enrollment review reopened after a fresh inventory sync from %s.", assetRef)
			if _, err := server.db.ExecContext(ctx, `
				UPDATE requests
				SET status = 'pending',
					assignee_id = NULL,
					description = $2,
					notes = $3,
					reference_key = NULLIF($4, ''),
					updated_at = NOW()
				WHERE id = $1::uuid
			`, existingID, description, waitingNote, referenceKey); err != nil {
				return err
			}
			_, err = server.db.ExecContext(ctx, `
				INSERT INTO request_comments (id, request_id, author_id, note, created_at)
				VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, NOW())
			`, existingID, requesterID, reopenNote)
			return err
		default:
			if assigned {
				return nil
			}
		}
	}

	if assigned {
		_ = assignedName
		_ = assignedEmpID
		return nil
	}

	_, err = server.db.ExecContext(ctx, `
		INSERT INTO requests (id, requester_id, type, title, description, status, notes, reference_key, created_at, updated_at)
		VALUES (gen_random_uuid(), $1::uuid, 'device_enrollment', $2, $3, 'pending', $4, NULLIF($5, ''), NOW(), NOW())
	`, requesterID, title, description, waitingNote, referenceKey)
	return err
}

func (server *apiServer) completeInventoryEnrollmentRequest(ctx context.Context, asset inventorysync.Asset) error {
	email := strings.TrimSpace(asset.AssignedToEmail)
	name := strings.TrimSpace(asset.AssignedToName)
	empID := strings.TrimSpace(asset.EmployeeCode)
	department := strings.TrimSpace(asset.DepartmentName)
	if email == "" && name == "" && empID == "" && department == "" {
		return nil
	}

	requesterID, err := server.inventoryEnrollmentRequesterID(ctx)
	if err != nil {
		return err
	}

	assetRef := inventoryEnrollmentAssetRef(asset)
	referenceKey := inventoryEnrollmentReferenceKey(assetRef)
	title := fmt.Sprintf("Device enrollment review for %s", assetRef)

	var requestID string
	requestID, _, err = server.lookupInventoryEnrollmentRequest(ctx, requesterID, referenceKey, title)
	if err != nil {
		return err
	}
	if requestID == "" {
		return nil
	}

	assignedName, assignedEmpID, assigned, err := server.lookupInventoryAssignedUser(ctx, asset)
	if err != nil {
		return err
	}
	if !assigned {
		return nil
	}

	completionNote := fmt.Sprintf("Enrollment review auto-completed after inventory ingest onboarded %s and assigned it to %s%s.", assetRef, fallbackString(assignedName, fallbackString(name, "the submitted employee")), func() string {
		resolvedEmpID := strings.TrimSpace(assignedEmpID)
		if resolvedEmpID == "" {
			resolvedEmpID = empID
		}
		if resolvedEmpID == "" {
			return ""
		}
		return fmt.Sprintf(" (%s)", resolvedEmpID)
	}())

	if _, err := server.db.ExecContext(ctx, `
		UPDATE requests
		SET status = 'resolved',
			notes = $2,
			updated_at = NOW()
		WHERE id = $1::uuid
	`, requestID, completionNote); err != nil {
		return err
	}

	_, err = server.db.ExecContext(ctx, `
		INSERT INTO request_comments (id, request_id, author_id, note, created_at)
		VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, NOW())
	`, requestID, requesterID, completionNote)
	return err
}

func (server *apiServer) inventoryEnrollmentRequesterID(ctx context.Context) (string, error) {
	var requesterID string
	err := server.db.QueryRowContext(ctx, `
		SELECT u.id::text
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE r.name = 'super_admin'
		ORDER BY u.created_at ASC
		LIMIT 1
	`).Scan(&requesterID)
	return requesterID, err
}

func (server *apiServer) lookupInventoryEnrollmentRequest(ctx context.Context, requesterID string, referenceKey string, title string) (string, string, error) {
	var requestID string
	var status string
	err := server.db.QueryRowContext(ctx, `
		SELECT id::text, status
		FROM requests
		WHERE requester_id = $1::uuid
		  AND type = 'device_enrollment'
		  AND (
				(NULLIF($2, '') IS NOT NULL AND reference_key = $2)
				OR title = $3
		  )
		ORDER BY updated_at DESC, created_at DESC, id DESC
		LIMIT 1
	`, requesterID, referenceKey, title).Scan(&requestID, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", nil
	}
	if err != nil {
		return "", "", err
	}
	return requestID, status, nil
}

func (server *apiServer) lookupInventoryAssignedUser(ctx context.Context, asset inventorysync.Asset) (string, string, bool, error) {
	var assignedName string
	var assignedEmpID string
	assetTag := strings.TrimSpace(asset.AssetTag)
	hostname := strings.TrimSpace(asset.Hostname)
	name := strings.TrimSpace(asset.Name)
	sourceFingerprint := strings.TrimSpace(asset.SourceFingerprint)
	err := server.db.QueryRowContext(ctx, `
		SELECT COALESCE(u.full_name, ''), COALESCE(u.emp_id, '')
		FROM assets a
		JOIN users u ON u.id = a.assigned_to
		WHERE ($1 <> '' AND a.source_fingerprint = $1)
		   OR ($2 <> '' AND a.asset_tag = $2)
		   OR ($3 <> '' AND a.hostname = $3)
		   OR ($4 <> '' AND a.name = $4)
		ORDER BY
			CASE
				WHEN $1 <> '' AND a.source_fingerprint = $1 THEN 0
				WHEN $2 <> '' AND a.asset_tag = $2 THEN 1
				WHEN $3 <> '' AND a.hostname = $3 THEN 2
				WHEN $4 <> '' AND a.name = $4 THEN 3
				ELSE 4
			END,
			a.updated_at DESC,
			a.created_at DESC
		LIMIT 1
	`, sourceFingerprint, assetTag, hostname, name).Scan(&assignedName, &assignedEmpID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	return assignedName, assignedEmpID, true, nil
}

func inventoryEnrollmentAssetRef(asset inventorysync.Asset) string {
	assetRef := strings.TrimSpace(asset.AssetTag)
	if assetRef == "" {
		assetRef = strings.TrimSpace(asset.Hostname)
	}
	if assetRef == "" {
		assetRef = strings.TrimSpace(asset.Name)
	}
	return assetRef
}

func inventoryEnrollmentReferenceKey(assetRef string) string {
	assetRef = strings.Join(strings.Fields(strings.TrimSpace(assetRef)), " ")
	if assetRef == "" {
		return ""
	}
	return fmt.Sprintf("device_enrollment:%s", strings.ToUpper(assetRef))
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func compatPatchStatus(pendingUpdates int) string {
	if pendingUpdates > 0 {
		return "pending"
	}
	return "up_to_date"
}

func compatAlertStatus(openAlerts int) string {
	if openAlerts > 0 {
		return "open"
	}
	return "healthy"
}

func compatComplianceScore(pendingUpdates int, openAlerts int) int {
	score := 100 - pendingUpdates*10 - openAlerts*15
	if score < 0 {
		return 0
	}
	return score
}

func mapName(name string) gin.H {
	if strings.TrimSpace(name) == "" {
		return nil
	}
	return gin.H{"name": name}
}

func mapUser(fullName string, email string, empID string, id string) gin.H {
	if strings.TrimSpace(fullName) == "" && strings.TrimSpace(email) == "" {
		return nil
	}
	return gin.H{"id": emptyToNil(id), "fullName": emptyToNil(fullName), "email": emptyToNil(email), "employeeCode": emptyToNil(empID)}
}

func (server *apiServer) getAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.assetAllowed(c, asset.EntityID, asset.AssignedTo) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	details, network, software, err := server.fetchAssetDetailBlocks(asset.ID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{
		"id": asset.ID, "asset_tag": asset.AssetTag, "name": asset.Name, "hostname": emptyToNil(asset.Hostname), "category": asset.Category, "is_compute": asset.IsCompute,
		"serial_number": emptyToNil(asset.SerialNumber), "model": emptyToNil(asset.Model), "entity_id": asset.EntityID, "assigned_to": emptyToNil(asset.AssignedTo),
		"dept_id": emptyToNil(asset.DeptID), "location_id": emptyToNil(asset.LocationID), "purchase_date": emptyToNil(asset.PurchaseDate), "cost": emptyToNil(asset.Cost), "warranty_until": emptyToNil(asset.WarrantyUntil), "maintenance_until": emptyToNil(asset.MaintenanceUntil),
		"status": asset.Status, "condition": asset.Condition, "glpi_id": zeroToNil(asset.GLPIID), "salt_minion_id": emptyToNil(asset.SaltMinionID), "wazuh_agent_id": emptyToNil(asset.WazuhAgentID),
		"notes": emptyToNil(asset.Notes), "compute_details": details, "network": network, "installed_software": software,
	})
}

func (server *apiServer) getDeviceCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "device view is only available for compute assets")
		return
	}
	if !server.assetAllowed(c, asset.EntityID, asset.AssignedTo) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}

	details, network, software, err := server.fetchAssetDetailBlocks(asset.ID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	var fullName, email, empID, deptName, branchName string
	_ = server.db.QueryRow(`
		SELECT COALESCE(u.full_name, ''), COALESCE(u.email, ''), COALESCE(u.emp_id, ''), COALESCE(d.name, ''), COALESCE(l.full_name, '')
		FROM assets a
		LEFT JOIN users u ON u.id = a.assigned_to
		LEFT JOIN departments d ON d.id = a.dept_id
		LEFT JOIN locations l ON l.id = a.location_id
		WHERE a.id = $1::uuid
	`, asset.ID).Scan(&fullName, &email, &empID, &deptName, &branchName)

	pendingUpdates := 0
	if rawPending, ok := details["pending_updates"].(int); ok {
		pendingUpdates = rawPending
	}
	alerts, err := server.collectAssetAlerts(c.Request.Context(), asset)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	hasOpenSCAPAlert := false
	for _, alert := range alerts {
		source, _ := alert["source"].(string)
		if strings.EqualFold(source, "openscap") {
			hasOpenSCAPAlert = true
			break
		}
	}
	installedApps := make([]gin.H, 0, len(software))
	for _, application := range software {
		installedApps = append(installedApps, gin.H{"id": application["id"], "name": application["name"], "version": application["version"], "installDate": application["install_date"], "source": application["source"]})
	}
	saltConnected := saltConnectionStatus(c.Request.Context(), server.salt, coalesceString(asset.SaltMinionID, asset.Hostname))

	httpx.JSON(c, http.StatusOK, gin.H{
		"id":                asset.ID,
		"assetId":           asset.AssetTag,
		"cost":              emptyToNil(asset.Cost),
		"glpiId":            zeroToNil(asset.GLPIID),
		"saltMinionId":      emptyToNil(asset.SaltMinionID),
		"salt_minion_id":    emptyToNil(asset.SaltMinionID),
		"wazuhAgentId":      emptyToNil(asset.WazuhAgentID),
		"hostname":          coalesceString(asset.Hostname, asset.AssetTag),
		"serialNumber":      emptyToNil(asset.SerialNumber),
		"manufacturer":      emptyToNil(asset.Manufacturer),
		"model":             emptyToNil(asset.Model),
		"deviceType":        asset.Category,
		"osName":            details["os_name"],
		"osVersion":         details["os_version"],
		"processor":         details["processor"],
		"memory":            details["ram"],
		"storage":           details["storage"],
		"gpu":               details["gpu"],
		"display":           details["display"],
		"macAddress":        details["mac_address"],
		"architecture":      details["architecture"],
		"biosVersion":       details["bios_version"],
		"kernelVersion":     details["kernel"],
		"osBuild":           details["os_build"],
		"lastBootAt":        details["last_boot"],
		"lastSeenAt":        details["last_seen"],
		"loggedInUsers":     details["logged_in_users"],
		"anydeskId":         details["anydesk_id"],
		"rustdeskId":        details["rustdesk_id"],
		"diskLayout":        details["disk_layout"],
		"volumes":           details["volumes"],
		"status":            asset.Status,
		"patchStatus":       compatPatchStatus(pendingUpdates),
		"alertStatus":       compatAlertStatus(len(alerts)),
		"complianceScore":   compatComplianceScore(pendingUpdates, len(alerts)),
		"warrantyExpiresAt": emptyToNil(asset.WarrantyUntil),
		"user":              mapUser(fullName, email, empID, asset.AssignedTo),
		"department":        mapName(deptName),
		"branch":            mapName(branchName),
		"network":           network,
		"installedApps":     installedApps,
		"toolStatus":        buildToolStatus(asset.SaltMinionID, saltConnected, asset.WazuhAgentID, softwareContains(software, "salt-minion", "salt minion", "saltstack"), softwareContains(software, "wazuh"), softwareContains(software, "openscap", "scap workbench", "scap security guide") || hasOpenSCAPAlert, softwareContains(software, "clamav", "clamd", "freshclam", "clamwin")),
	})
}

func (server *apiServer) getDeviceAlertsCompat(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.assetAllowed(c, asset.EntityID, asset.AssignedTo) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	alerts, err := server.collectAssetAlerts(c.Request.Context(), asset)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	result := make([]gin.H, 0, len(alerts))
	for _, alert := range alerts {
		result = append(result, gin.H{
			"id":           alert["id"],
			"source":       alert["source"],
			"severity":     alert["severity"],
			"title":        alert["title"],
			"detail":       alert["detail"],
			"acknowledged": false,
			"resolved":     alert["resolved"],
			"createdAt":    alert["created_at"],
		})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) createAsset(c *gin.Context) { server.upsertAsset(c, true) }
func (server *apiServer) updateAsset(c *gin.Context) { server.upsertAsset(c, false) }

func (server *apiServer) upsertAsset(c *gin.Context, create bool) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		AssetTag      string `json:"asset_tag"`
		Name          string `json:"name"`
		Hostname      string `json:"hostname"`
		Category      string `json:"category"`
		IsCompute     bool   `json:"is_compute"`
		SerialNumber  string `json:"serial_number"`
		Model         string `json:"model"`
		EntityID      string `json:"entity_id"`
		AssignedTo    string `json:"assigned_to"`
		DeptID        string `json:"dept_id"`
		LocationID    string `json:"location_id"`
		PurchaseDate  string `json:"purchase_date"`
		Cost          string `json:"cost"`
		WarrantyUntil string `json:"warranty_until"`
		Status        string `json:"status"`
		Condition     string `json:"condition"`
		GLPIID        *int   `json:"glpi_id"`
		SaltMinionID  string `json:"salt_minion_id"`
		WazuhAgentID  string `json:"wazuh_agent_id"`
		Notes         string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid asset payload")
		return
	}
	if create {
		if !server.entityAllowedByID(c, input.EntityID) {
			httpx.Error(c, http.StatusForbidden, "forbidden")
			return
		}
	} else {
		existingAsset, err := server.fetchAsset(c.Param("id"))
		if err != nil {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		if !server.entityAllowedByID(c, existingAsset.EntityID) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		if strings.TrimSpace(input.EntityID) != "" && !server.entityAllowedByID(c, input.EntityID) {
			httpx.Error(c, http.StatusForbidden, "forbidden")
			return
		}
	}
	if err := server.validateEntityLinks(input.EntityID, input.DeptID, input.LocationID); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var err error
	hostname := strings.ToLower(strings.TrimSpace(input.Hostname))
	if input.IsCompute {
		if hostname == "" {
			hostname, err = server.allocateHostname(c.Request.Context(), input.EntityID, input.DeptID)
			if err != nil {
				httpx.Error(c, http.StatusBadRequest, err.Error())
				return
			}
		}
		if !hostnamePattern.MatchString(hostname) {
			httpx.Error(c, http.StatusBadRequest, "hostname must be lowercase alphanumeric and hyphen only")
			return
		}
	}
	if create {
		var id string
		glpiID := 0
		if input.GLPIID != nil {
			glpiID = *input.GLPIID
		}
		err := server.db.QueryRow(`
			INSERT INTO assets (
				asset_tag, name, hostname, category, is_compute, serial_number, model, entity_id, assigned_to, dept_id, location_id,
				purchase_date, cost, warranty_until, status, condition, glpi_id, salt_minion_id, wazuh_agent_id, notes
			) VALUES (
				$1, $2, NULLIF($3, ''), $4, $5, NULLIF($6, ''), NULLIF($7, ''), $8::uuid, NULLIF($9, '')::uuid, NULLIF($10, '')::uuid, NULLIF($11, '')::uuid,
				NULLIF($12, '')::date, NULLIF($13, '')::numeric(12,2), NULLIF($14, '')::date, COALESCE(NULLIF($15, ''), 'in_use'), COALESCE(NULLIF($16, ''), 'good'), NULLIF($17, 0), NULLIF($18, ''), NULLIF($19, ''), NULLIF($20, '')
			) RETURNING id
		`, input.AssetTag, input.Name, hostname, strings.ToLower(input.Category), input.IsCompute, input.SerialNumber, input.Model, input.EntityID, input.AssignedTo, input.DeptID, input.LocationID, input.PurchaseDate, input.Cost, input.WarrantyUntil, strings.ToLower(input.Status), strings.ToLower(input.Condition), glpiID, coalesceString(input.SaltMinionID, hostname), input.WazuhAgentID, input.Notes).Scan(&id)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		if input.AssignedTo != "" {
			_, _ = server.recordAssetHistory(id, middleware.CurrentClaims(c).UserID, "asset_assigned", gin.H{"assigned_to": input.AssignedTo})
		}
		middleware.TagAudit(c, middleware.AuditMeta{Action: "asset_created", TargetType: "asset", TargetID: id, Detail: input})
		httpx.Created(c, gin.H{"id": id, "hostname": emptyToNil(hostname)})
		return
	}
	_, err = server.db.Exec(`
		UPDATE assets
		SET asset_tag = COALESCE(NULLIF($2, ''), asset_tag),
			name = COALESCE(NULLIF($3, ''), name),
			hostname = COALESCE(NULLIF($4, ''), hostname),
			category = COALESCE(NULLIF($5, ''), category),
			is_compute = COALESCE($6, is_compute),
			serial_number = COALESCE($7, serial_number),
			model = COALESCE($8, model),
			entity_id = COALESCE(NULLIF($9, '')::uuid, entity_id),
			assigned_to = NULLIF($10, '')::uuid,
			dept_id = NULLIF($11, '')::uuid,
			location_id = NULLIF($12, '')::uuid,
			purchase_date = COALESCE(NULLIF($13, '')::date, purchase_date),
			cost = COALESCE(NULLIF($14, '')::numeric(12,2), cost),
			warranty_until = COALESCE(NULLIF($15, '')::date, warranty_until),
			status = COALESCE(NULLIF($16, ''), status),
			condition = COALESCE(NULLIF($17, ''), condition),
			glpi_id = COALESCE(NULLIF($18, 0), glpi_id),
			salt_minion_id = COALESCE(NULLIF($19, ''), salt_minion_id),
			wazuh_agent_id = COALESCE(NULLIF($20, ''), wazuh_agent_id),
			notes = COALESCE($21, notes),
			updated_at = NOW()
		WHERE id = $1::uuid
	`, c.Param("id"), input.AssetTag, input.Name, hostname, strings.ToLower(input.Category), input.IsCompute, input.SerialNumber, input.Model, input.EntityID, input.AssignedTo, input.DeptID, input.LocationID, input.PurchaseDate, input.Cost, input.WarrantyUntil, strings.ToLower(input.Status), strings.ToLower(input.Condition), derefInt(input.GLPIID), coalesceString(input.SaltMinionID, hostname), input.WazuhAgentID, input.Notes)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "asset_updated", TargetType: "asset", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) assignAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		UserID string `json:"user_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.UserID == "" {
		httpx.Error(c, http.StatusBadRequest, "user_id is required")
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	user, err := server.fetchUserByID(input.UserID)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, "user not found")
		return
	}
	if !server.entityAllowedByID(c, user.EntityID) {
		httpx.Error(c, http.StatusBadRequest, "user not found")
		return
	}
	if err := server.validateEntityLinks(user.EntityID, user.DeptID, user.LocationID); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	_, err = server.db.Exec(`
		UPDATE assets
		SET assigned_to = $2::uuid, entity_id = $3::uuid, dept_id = NULLIF($4, '')::uuid, location_id = NULLIF($5, '')::uuid, updated_at = NOW()
		WHERE id = $1::uuid
	`, asset.ID, user.ID, user.EntityID, user.DeptID, user.LocationID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	_, _ = server.recordAssetHistory(asset.ID, middleware.CurrentClaims(c).UserID, "asset_assigned", gin.H{"user_id": user.ID})
	middleware.TagAudit(c, middleware.AuditMeta{Action: "asset_assigned", TargetType: "asset", TargetID: asset.ID, Detail: gin.H{"user_id": user.ID}})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) unassignAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	_, err = server.db.Exec(`UPDATE assets SET assigned_to = NULL, updated_at = NOW() WHERE id = $1::uuid`, c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	_, _ = server.recordAssetHistory(c.Param("id"), middleware.CurrentClaims(c).UserID, "asset_unassigned", gin.H{})
	middleware.TagAudit(c, middleware.AuditMeta{Action: "asset_unassigned", TargetType: "asset", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deleteAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	result, err := server.db.Exec(`DELETE FROM assets WHERE id = $1::uuid`, asset.ID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "asset_deleted",
		TargetType: "asset",
		TargetID:   asset.ID,
		Detail: gin.H{
			"asset_tag":   asset.AssetTag,
			"name":        asset.Name,
			"category":    asset.Category,
			"assigned_to": emptyToNil(asset.AssignedTo),
		},
	})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) setAssetMaintenance(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}

	var body struct {
		MaintenanceUntil *string `json:"maintenance_until"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid request body")
		return
	}

	var maintenanceUntilSQL interface{}
	if body.MaintenanceUntil != nil && strings.TrimSpace(*body.MaintenanceUntil) != "" {
		// Validate timestamp format
		_, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*body.MaintenanceUntil))
		if parseErr != nil {
			httpx.Error(c, http.StatusBadRequest, "invalid timestamp format, use RFC3339 (e.g., 2026-06-28T12:00:00Z)")
			return
		}
		maintenanceUntilSQL = strings.TrimSpace(*body.MaintenanceUntil)
	} else {
		maintenanceUntilSQL = nil
	}

	_, err = server.db.Exec(`UPDATE assets SET maintenance_until = $1 WHERE id = $2::uuid`, maintenanceUntilSQL, asset.ID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "asset_maintenance_updated",
		TargetType: "asset",
		TargetID:   asset.ID,
		Detail: gin.H{
			"asset_tag":         asset.AssetTag,
			"maintenance_until": body.MaintenanceUntil,
		},
	})

	httpx.JSON(c, http.StatusOK, gin.H{"ok": true, "maintenance_until": body.MaintenanceUntil})
}

func (server *apiServer) setBulkAssetMaintenance(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	var body struct {
		AssetIDs         []string `json:"asset_ids" binding:"required"`
		MaintenanceUntil *string  `json:"maintenance_until"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid request body: asset_ids required")
		return
	}

	if len(body.AssetIDs) == 0 {
		httpx.Error(c, http.StatusBadRequest, "asset_ids cannot be empty")
		return
	}

	var maintenanceUntilSQL interface{}
	if body.MaintenanceUntil != nil && strings.TrimSpace(*body.MaintenanceUntil) != "" {
		// Validate timestamp format
		_, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(*body.MaintenanceUntil))
		if parseErr != nil {
			httpx.Error(c, http.StatusBadRequest, "invalid timestamp format, use RFC3339 (e.g., 2026-06-28T12:00:00Z)")
			return
		}
		maintenanceUntilSQL = strings.TrimSpace(*body.MaintenanceUntil)
	} else {
		maintenanceUntilSQL = nil
	}

	// Verify all assets exist and user has access
	placeholders := make([]string, len(body.AssetIDs))
	args := make([]interface{}, len(body.AssetIDs))
	for i, id := range body.AssetIDs {
		placeholders[i] = fmt.Sprintf("$%d::uuid", i+1)
		args[i] = id
	}

	query := fmt.Sprintf("SELECT id, entity_id::text FROM assets WHERE id IN (%s)", strings.Join(placeholders, ", "))
	rows, err := server.db.Query(query, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	allowedAssetIDs := make([]string, 0, len(body.AssetIDs))
	for rows.Next() {
		var assetID, entityID string
		if err := rows.Scan(&assetID, &entityID); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if server.entityAllowedByID(c, entityID) {
			allowedAssetIDs = append(allowedAssetIDs, assetID)
		}
	}

	if len(allowedAssetIDs) == 0 {
		httpx.Error(c, http.StatusNotFound, "no accessible assets found")
		return
	}

	// Update maintenance_until for all allowed assets
	updatePlaceholders := make([]string, len(allowedAssetIDs))
	updateArgs := make([]interface{}, len(allowedAssetIDs)+1)
	updateArgs[0] = maintenanceUntilSQL
	for i, id := range allowedAssetIDs {
		updatePlaceholders[i] = fmt.Sprintf("$%d::uuid", i+2)
		updateArgs[i+1] = id
	}

	updateQuery := fmt.Sprintf("UPDATE assets SET maintenance_until = $1 WHERE id IN (%s)", strings.Join(updatePlaceholders, ", "))
	result, err := server.db.Exec(updateQuery, updateArgs...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	rowsAffected, _ := result.RowsAffected()

	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "asset_maintenance_bulk_updated",
		TargetType: "asset",
		Detail: gin.H{
			"asset_count":       rowsAffected,
			"asset_ids":         allowedAssetIDs,
			"maintenance_until": body.MaintenanceUntil,
		},
	})

	httpx.JSON(c, http.StatusOK, gin.H{"ok": true, "updated_count": rowsAffected, "maintenance_until": body.MaintenanceUntil})
}

func (server *apiServer) getAssetHistory(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "asset not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !server.assetAllowed(c, asset.EntityID, asset.AssignedTo) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	rows, err := server.db.Query(`
		SELECT h.id, COALESCE(u.full_name, ''), h.action, h.detail, h.created_at
		FROM asset_history h
		LEFT JOIN users u ON u.id = h.actor_id
		WHERE h.asset_id = $1::uuid
		ORDER BY h.created_at DESC
	`, c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	for rows.Next() {
		var id, actor, action string
		var detailRaw []byte
		var createdAt time.Time
		if err := rows.Scan(&id, &actor, &action, &detailRaw, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		var detail any
		_ = json.Unmarshal(detailRaw, &detail)
		if action == "patch_run" {
			if patchDetail, ok := detail.(map[string]any); ok {
				patchDetail["status"] = patchRunStatus(patchDetail)
			}
		}
		items = append(items, gin.H{"id": id, "actor": emptyToNil(actor), "action": action, "detail": detail, "created_at": createdAt})
	}
	httpx.JSON(c, http.StatusOK, items)
}

func (server *apiServer) getAssetAlerts(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "employee", "auditor") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.assetAllowed(c, asset.EntityID, asset.AssignedTo) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	items, err := server.collectAssetAlerts(c.Request.Context(), asset)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, items)
}

func (server *apiServer) runAssetPatch(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "patch run is only available for compute assets")
		return
	}
	var input struct {
		Action  string `json:"action"`
		State   string `json:"state"`
		Command string `json:"command"`
	}
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&input); err != nil {
			httpx.Error(c, http.StatusBadRequest, "invalid patch payload")
			return
		}
	}
	result, err := server.queuePatchRun(c, asset, input.Action, input.State, input.Command)
	if err != nil {
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "patch_run", TargetType: "asset", TargetID: asset.ID, Detail: result})
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) runAssetScript(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "scripts are only available for compute assets")
		return
	}
	var input struct {
		Script string `json:"script"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid script payload")
		return
	}
	target := coalesceString(asset.SaltMinionID, asset.Hostname)
	response := gin.H{"status": "queued", "script": input.Script, "target": target}
	definition, ok := server.resolveAssetScriptDefinition(asset, strings.TrimSpace(strings.ToLower(input.Script)))
	if ok {
		response["state"] = definition.State
		if len(definition.FollowUp) > 0 {
			response["follow_up_states"] = definition.FollowUp
		}
		response["component"] = definition.Component
		response["integration"] = definition.Integration
		if definition.Integration == "saltstack" {
			if server.salt == nil || !server.salt.Enabled() {
				httpx.Error(c, http.StatusBadGateway, "saltstack integration is not configured")
				return
			}
			result, err := server.salt.RunState(c.Request.Context(), target, definition.State)
			if err != nil {
				httpx.Error(c, http.StatusBadGateway, err.Error())
				return
			}
			response["result"] = result
			if len(definition.FollowUp) > 0 {
				followUpResults := make([]gin.H, 0, len(definition.FollowUp))
				for _, stateName := range definition.FollowUp {
					followUpResult, err := server.salt.RunState(c.Request.Context(), target, stateName)
					if err != nil {
						httpx.Error(c, http.StatusBadGateway, fmt.Sprintf("state %s failed: %v", stateName, err))
						return
					}
					followUpResults = append(followUpResults, gin.H{"state": stateName, "result": followUpResult})
				}
				response["follow_up_results"] = followUpResults
			}
		}
	} else {
		response["integration"] = "local_history"
	}

	_, _ = server.recordAssetHistory(asset.ID, middleware.CurrentClaims(c).UserID, "script_run", response)
	middleware.TagAudit(c, middleware.AuditMeta{Action: "script_run", TargetType: "asset", TargetID: asset.ID, Detail: response})
	httpx.JSON(c, http.StatusOK, response)
}

func (server *apiServer) resolveAssetScriptDefinition(asset dbAsset, script string) (assetScriptDefinition, bool) {
	if script == "refresh-inventory" || script == "refresh_inventory" || script == "refresh_itms_inventory" {
		platform := server.detectAssetPlatform(asset.ID)
		refreshStates := optionalStates(strings.TrimSpace(server.config.SaltInventoryRefreshState))
		switch platform {
		case "windows":
			refreshStates = optionalStates(strings.TrimSpace(server.config.SaltInventoryRefreshWindowsState), strings.TrimSpace(server.config.SaltInventoryRefreshState))
		case "ubuntu":
			refreshStates = optionalStates(strings.TrimSpace(server.config.SaltInventoryRefreshUbuntuState), strings.TrimSpace(server.config.SaltInventoryRefreshState))
		}
		if len(refreshStates) == 0 {
			return assetScriptDefinition{}, false
		}
		return assetScriptDefinition{
			State:       refreshStates[0],
			FollowUp:    refreshStates[1:],
			Component:   "inventory",
			Integration: "saltstack",
		}, true
	}

	if script == "install-agent" || script == "install_agent" || script == "install_itms_agent" {
		platform := server.detectAssetPlatform(asset.ID)
		installState := firstNonEmpty(strings.TrimSpace(server.config.SaltAgentInstallState), "itms_agent.install")
		refreshStates := optionalStates(strings.TrimSpace(server.config.SaltInventoryRefreshState))
		switch platform {
		case "windows":
			installState = firstNonEmpty(strings.TrimSpace(server.config.SaltAgentInstallWindowsState), installState)
			refreshStates = optionalStates(strings.TrimSpace(server.config.SaltInventoryRefreshWindowsState), strings.TrimSpace(server.config.SaltInventoryRefreshState))
		case "ubuntu":
			installState = firstNonEmpty(strings.TrimSpace(server.config.SaltAgentInstallUbuntuState), installState)
			refreshStates = optionalStates(strings.TrimSpace(server.config.SaltInventoryRefreshUbuntuState), strings.TrimSpace(server.config.SaltInventoryRefreshState))
		}
		return assetScriptDefinition{
			State:       installState,
			FollowUp:    refreshStates,
			Component:   "itms_agent",
			Integration: "saltstack",
		}, true
	}

	return assetScriptDefinition{}, false
}

func (server *apiServer) resolveAssetPatchDefinition(asset dbAsset, action string, state string, command string) (assetPatchDefinition, error) {
	normalizedAction := strings.TrimSpace(strings.ToLower(action))
	if normalizedAction == "" {
		normalizedAction = "system-update"
	}

	switch normalizedAction {
	case "system-update", "system_update", "patch", "default":
		return assetPatchDefinition{
			Action:      "system-update",
			State:       "patch.run",
			Component:   "patch",
			Integration: "saltstack",
		}, nil
	case "chrome-update", "chrome_update":
		platform := server.detectAssetPlatform(asset.ID)
		if platform != "ubuntu" && platform != "windows" {
			return assetPatchDefinition{}, fmt.Errorf("chrome update is currently supported for Ubuntu, Debian, or Windows assets only")
		}
		command := "apt-get update && apt-get install --only-upgrade -y google-chrome-stable"
		if platform == "windows" {
			command = `powershell -NoProfile -Command "$chromeUpdate = Join-Path ${env:ProgramFiles(x86)} 'Google\\Update\\GoogleUpdate.exe'; if (Test-Path $chromeUpdate) { & $chromeUpdate /ua /installsource scheduler } elseif (Get-Command winget -ErrorAction SilentlyContinue) { winget upgrade --id Google.Chrome --silent --accept-source-agreements --accept-package-agreements } else { throw 'Google Chrome updater not found' }"`
		}
		return assetPatchDefinition{
			Action:      "chrome-update",
			Command:     command,
			Component:   "patch",
			Integration: "saltstack",
		}, nil
	case "check-salt-minion", "check_salt_minion":
		command := "systemctl status --no-pager salt-minion"
		if server.detectAssetPlatform(asset.ID) == "windows" {
			command = `powershell -NoProfile -Command "Get-Service -Name salt-minion | Format-Table -Auto Name,Status,StartType"`
		}
		return assetPatchDefinition{
			Action:      "check-salt-minion",
			Command:     command,
			Component:   "patch",
			Integration: "saltstack",
		}, nil
	case "restart-salt-minion", "restart_salt_minion":
		command := "systemctl restart salt-minion && systemctl status --no-pager salt-minion"
		if server.detectAssetPlatform(asset.ID) == "windows" {
			command = `powershell -NoProfile -Command "Restart-Service -Name salt-minion -Force; Get-Service -Name salt-minion | Format-Table -Auto Name,Status,StartType"`
		}
		return assetPatchDefinition{
			Action:      "restart-salt-minion",
			Command:     command,
			Component:   "patch",
			Integration: "saltstack",
		}, nil
	case "custom-command", "custom_command", "command":
		trimmedCommand := strings.TrimSpace(command)
		if trimmedCommand == "" {
			return assetPatchDefinition{}, fmt.Errorf("command is required for the selected patch action")
		}
		return assetPatchDefinition{
			Action:      "custom-command",
			Command:     trimmedCommand,
			Component:   "patch",
			Integration: "saltstack",
		}, nil
	case "custom-state", "custom_state", "state":
		trimmedState := strings.TrimSpace(state)
		if trimmedState == "" {
			return assetPatchDefinition{}, fmt.Errorf("state is required for the selected patch action")
		}
		if !regexp.MustCompile(`^[a-zA-Z0-9._-]+$`).MatchString(trimmedState) {
			return assetPatchDefinition{}, fmt.Errorf("invalid state name")
		}
		return assetPatchDefinition{
			Action:      "custom-state",
			State:       trimmedState,
			Component:   "patch",
			Integration: "saltstack",
		}, nil
	default:
		return assetPatchDefinition{}, fmt.Errorf("unsupported patch action")
	}
}

func (server *apiServer) detectAssetPlatform(assetID string) string {
	var osName string
	err := server.db.QueryRow(`SELECT COALESCE(os_name, '') FROM asset_compute_details WHERE asset_id = $1::uuid`, assetID).Scan(&osName)
	if err != nil {
		return ""
	}
	normalized := strings.ToLower(strings.TrimSpace(osName))
	if strings.Contains(normalized, "windows") {
		return "windows"
	}
	if strings.Contains(normalized, "ubuntu") || strings.Contains(normalized, "debian") || strings.Contains(normalized, "linux") {
		return "ubuntu"
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func commandRunStatus(result map[string]any) string {
	if result == nil {
		return "queued"
	}
	if rawRetcode, ok := result["retcode"]; ok {
		switch value := rawRetcode.(type) {
		case float64:
			if value == 0 {
				return "completed"
			}
			return "failed"
		case int:
			if value == 0 {
				return "completed"
			}
			return "failed"
		case int64:
			if value == 0 {
				return "completed"
			}
			return "failed"
		}
	}
	if rawSuccess, ok := result["success"].(bool); ok {
		if rawSuccess {
			return "completed"
		}
		return "failed"
	}
	return "queued"
}

func optionalStates(values ...string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func buildToolStatus(saltMinionID string, saltConnected *bool, wazuhAgentID string, hasSaltSoftware bool, hasWazuhSoftware bool, hasOpenSCAPSignal bool, hasClamAVSoftware bool) gin.H {
	return gin.H{
		"salt":     saltToolStatusEntry(strings.TrimSpace(saltMinionID), saltConnected, hasSaltSoftware),
		"wazuh":    toolStatusEntry(strings.TrimSpace(wazuhAgentID), hasWazuhSoftware, "Wazuh agent ID linked", "Wazuh software detected", "Wazuh not detected"),
		"openscap": softwareToolStatusEntry(hasOpenSCAPSignal, "OpenSCAP detected", "OpenSCAP not detected"),
		"clamav":   softwareToolStatusEntry(hasClamAVSoftware, "ClamAV detected", "ClamAV not detected"),
	}
}

func saltToolStatusEntry(identifier string, connected *bool, softwareDetected bool) gin.H {
	if identifier != "" {
		if connected != nil {
			if *connected {
				return gin.H{"status": "linked", "detail": "Salt minion connected to master", "identifier": identifier, "connected": true}
			}
			return gin.H{"status": "detected", "detail": "Salt minion ID linked, but the master has no active connection for this asset", "identifier": identifier, "connected": false}
		}
		if softwareDetected {
			return gin.H{"status": "linked", "detail": "Salt minion ID linked", "identifier": identifier}
		}
		return gin.H{"status": "detected", "detail": "Salt minion ID linked", "identifier": identifier}
	}
	if softwareDetected {
		return gin.H{"status": "detected", "detail": "Salt software detected"}
	}
	return gin.H{"status": "missing", "detail": "Salt not detected"}
}

func toolStatusEntry(identifier string, softwareDetected bool, linkedDetail string, detectedDetail string, missingDetail string) gin.H {
	if identifier != "" && softwareDetected {
		return gin.H{"status": "linked", "detail": linkedDetail, "identifier": identifier}
	}
	if softwareDetected {
		return gin.H{"status": "detected", "detail": detectedDetail}
	}
	if identifier != "" {
		return gin.H{"status": "detected", "detail": linkedDetail, "identifier": identifier}
	}
	return gin.H{"status": "missing", "detail": missingDetail}
}

func softwareToolStatusEntry(installed bool, installedDetail string, missingDetail string) gin.H {
	if installed {
		return gin.H{"status": "installed", "detail": installedDetail}
	}
	return gin.H{"status": "missing", "detail": missingDetail}
}

func saltConnectionStatus(ctx context.Context, client *saltstack.Client, target string) *bool {
	if client == nil || !client.Enabled() || strings.TrimSpace(target) == "" {
		return nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	connected, err := client.TargetConnected(probeCtx, target)
	if err != nil {
		return nil
	}
	return &connected
}

func softwareContains(software []gin.H, terms ...string) bool {
	for _, item := range software {
		name, _ := item["name"].(string)
		normalized := strings.ToLower(strings.TrimSpace(name))
		if normalized == "" {
			continue
		}
		for _, term := range terms {
			if strings.Contains(normalized, strings.ToLower(strings.TrimSpace(term))) {
				return true
			}
		}
	}
	return false
}

func (server *apiServer) getAssetTerminal(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	asset, err := server.fetchAsset(c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !asset.IsCompute {
		httpx.Error(c, http.StatusBadRequest, "terminal is only available for compute assets")
		return
	}
	payload, err := server.buildTerminalPayload(asset)
	if err != nil {
		server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "terminal", "high", "Terminal session unavailable", err.Error())
		httpx.Error(c, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, payload)
}

func (server *apiServer) suggestHostname(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	entityID := c.Query("entity_id")
	deptID := c.Query("dept_id")
	if entityID == "" || deptID == "" {
		httpx.Error(c, http.StatusBadRequest, "entity_id and dept_id are required")
		return
	}
	if !server.entityAllowedByID(c, entityID) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	hostname, err := server.peekHostname(c.Request.Context(), entityID, deptID)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, gin.H{"hostname": hostname})
}

func (server *apiServer) listAudit(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	page, pageSize, paginate := parsePaginationRequest(c, 25)
	entityID := c.Query("entity")
	if strings.TrimSpace(entityID) != "" && claims.Role != "super_admin" && !server.entityAllowedByID(c, strings.TrimSpace(entityID)) {
		httpx.Error(c, http.StatusForbidden, "forbidden")
		return
	}
	actorQuery := strings.TrimSpace(c.Query("actor"))
	actionQuery := strings.TrimSpace(c.Query("action"))
	targetTypeFilter := strings.TrimSpace(strings.ToLower(c.Query("entity_type")))
	targetIDFilter := strings.TrimSpace(c.Query("entity_id"))
	moduleFilter := strings.TrimSpace(strings.ToLower(c.Query("module")))
	searchQuery := strings.TrimSpace(strings.ToLower(c.Query("search")))
	whereClauses := []string{"1 = 1"}
	args := make([]any, 0, 8)
	argIndex := 1
	if claims.Role != "super_admin" {
		entityArg := argIndex
		userArg := argIndex + 1
		whereClauses = append(whereClauses, fmt.Sprintf("(a.entity_id = $%d::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $%d::uuid AND uea.entity_id = a.entity_id))", entityArg, userArg))
		args = append(args, claims.EntityID, claims.UserID)
		argIndex += 2
	}
	if strings.TrimSpace(entityID) != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.entity_id = $%d::uuid", argIndex))
		args = append(args, strings.TrimSpace(entityID))
		argIndex++
	}
	if actionQuery != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("a.action = $%d", argIndex))
		args = append(args, actionQuery)
		argIndex++
	}
	if actorQuery != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("lower(COALESCE(u.full_name, '') || ' ' || COALESCE(u.emp_id, '')) LIKE $%d", argIndex))
		args = append(args, "%"+strings.ToLower(actorQuery)+"%")
		argIndex++
	}
	rows, err := server.db.Query(`
		SELECT a.id, COALESCE(u.full_name, ''), COALESCE(u.emp_id, ''), COALESCE(e.short_code, ''), a.action, COALESCE(a.target_type, ''), COALESCE(a.target_id::text, ''), a.detail, a.created_at
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.actor_id
		LEFT JOIN entities e ON e.id = a.entity_id
		WHERE `+strings.Join(whereClauses, " AND ")+`
		ORDER BY a.created_at DESC
		LIMIT 500
	`, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]gin.H, 0)
	moduleCounts := map[string]int{}
	for rows.Next() {
		var id, actor, empID, entityCode, action, targetType, targetID string
		var detailRaw []byte
		var createdAt time.Time
		if err := rows.Scan(&id, &actor, &empID, &entityCode, &action, &targetType, &targetID, &detailRaw, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		var detail any
		_ = json.Unmarshal(detailRaw, &detail)
		module := auditModuleForTargetType(targetType)
		summary := auditSummaryForAction(action, targetType, detail)
		if searchQuery != "" {
			searchable := strings.ToLower(strings.Join([]string{summary, action, targetType, actor, empID, targetID, module}, " "))
			if !strings.Contains(searchable, searchQuery) {
				continue
			}
		}
		if targetTypeFilter != "" && strings.ToLower(strings.TrimSpace(targetType)) != targetTypeFilter {
			continue
		}
		if targetIDFilter != "" && strings.TrimSpace(targetID) != targetIDFilter {
			continue
		}
		if moduleFilter != "" && moduleFilter != "all" && module != moduleFilter {
			continue
		}
		moduleCounts[module]++
		items = append(items, gin.H{
			"id":          id,
			"timestamp":   createdAt,
			"createdAt":   createdAt,
			"actor":       gin.H{"fullName": emptyToNil(actor), "email": emptyToNil(empID)},
			"emp_id":      emptyToNil(empID),
			"entity":      emptyToNil(entityCode),
			"action":      action,
			"target_type": emptyToNil(targetType),
			"target_id":   emptyToNil(targetID),
			"entityType":  emptyToNil(targetType),
			"entityId":    emptyToNil(targetID),
			"summary":     summary,
			"module":      module,
			"subject":     nil,
			"detail":      detail,
		})
	}
	if !paginate {
		httpx.JSON(c, http.StatusOK, items)
		return
	}
	moduleSummary := make([]namedCount, 0, len(moduleCounts))
	for name, count := range moduleCounts {
		moduleSummary = append(moduleSummary, namedCount{Name: name, Count: count})
	}
	sort.Slice(moduleSummary, func(i, j int) bool {
		if moduleSummary[i].Count == moduleSummary[j].Count {
			return moduleSummary[i].Name < moduleSummary[j].Name
		}
		return moduleSummary[i].Count > moduleSummary[j].Count
	})
	start, end := paginationBounds(len(items), page, pageSize)
	httpx.JSON(c, http.StatusOK, gin.H{
		"items":    items[start:end],
		"total":    len(items),
		"page":     page,
		"pageSize": pageSize,
		"summary": gin.H{
			"moduleCounts": moduleSummary,
		},
	})
}

func (server *apiServer) getAudit(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	var detailRaw []byte
	var actor, action, targetType, targetID, entityID string
	var createdAt time.Time
	err := server.db.QueryRow(`
		SELECT COALESCE(actor_id::text, ''), COALESCE(entity_id::text, ''), action, COALESCE(target_type, ''), COALESCE(target_id::text, ''), detail, created_at
		FROM audit_log WHERE id = $1::uuid
	`, c.Param("id")).Scan(&actor, &entityID, &action, &targetType, &targetID, &detailRaw, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "audit record not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if claims.Role != "super_admin" && (strings.TrimSpace(entityID) == "" || !server.entityAllowedByID(c, entityID)) {
		httpx.Error(c, http.StatusNotFound, "audit record not found")
		return
	}
	var detail any
	_ = json.Unmarshal(detailRaw, &detail)
	httpx.JSON(c, http.StatusOK, gin.H{"id": c.Param("id"), "actor_id": emptyToNil(actor), "entity_id": emptyToNil(entityID), "action": action, "target_type": emptyToNil(targetType), "target_id": emptyToNil(targetID), "detail": detail, "created_at": createdAt})
}

func (server *apiServer) exportAudit(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	query := `
		SELECT a.created_at, COALESCE(u.full_name, ''), COALESCE(u.emp_id, ''), COALESCE(e.short_code, ''), a.action, COALESCE(a.target_type, ''), COALESCE(a.target_id::text, ''), a.detail
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.actor_id
		LEFT JOIN entities e ON e.id = a.entity_id
	`
	args := make([]any, 0, 2)
	if claims.Role != "super_admin" {
		query += `
		WHERE (a.entity_id = $1::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $2::uuid AND uea.entity_id = a.entity_id))`
		args = append(args, claims.EntityID, claims.UserID)
	}
	query += `
		ORDER BY a.created_at DESC
		LIMIT 5000
	`
	rows, err := server.db.Query(query, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=audit-log.csv")
	writer := csv.NewWriter(c.Writer)
	_ = writer.Write([]string{"timestamp", "actor", "emp_id", "entity", "action", "target_type", "target_id", "detail"})
	for rows.Next() {
		var createdAt time.Time
		var actor, empID, entityCode, action, targetType, targetID string
		var detailRaw []byte
		if err := rows.Scan(&createdAt, &actor, &empID, &entityCode, &action, &targetType, &targetID, &detailRaw); err != nil {
			continue
		}
		_ = writer.Write([]string{createdAt.Format(time.RFC3339), actor, empID, entityCode, action, targetType, targetID, string(detailRaw)})
	}
	writer.Flush()
}

type dbUser struct {
	ID             string
	EmpID          string
	FullName       string
	Email          string
	EntityID       string
	DeptID         string
	LocationID     string
	Role           string
	PasswordHash   string
	IsActive       bool
	MFAEnabled     bool
	TOTPSecret     sql.NullString
	MFABackupCodes []string
}

type dbAsset struct {
	ID            string
	AssetTag      string
	Name          string
	Hostname      string
	Category      string
	IsCompute     bool
	SerialNumber  string
	Model         string
	EntityID      string
	AssignedTo    string
	DeptID        string
	LocationID    string
	PurchaseDate  string
	Cost          string
	WarrantyUntil string
	MaintenanceUntil string
	Status        string
	Condition     string
	GLPIID        int
	Manufacturer  string
	SaltMinionID  string
	WazuhAgentID  string
	Notes         string
}

func (server *apiServer) fetchUserByEmail(email string) (dbUser, error) {
	return server.fetchUser(`WHERE lower(u.email) = lower($1)`, email)
}

func (server *apiServer) fetchUserByID(id string) (dbUser, error) {
	return server.fetchUser(`WHERE u.id = $1::uuid`, id)
}

func (server *apiServer) fetchUser(predicate string, arg string) (dbUser, error) {
	var user dbUser
	var entityID sql.NullString
	var deptID sql.NullString
	var locationID sql.NullString
	var passwordHash sql.NullString
	err := server.db.QueryRow(`
		SELECT u.id, u.emp_id, u.full_name, u.email, u.entity_id::text, u.dept_id::text, u.location_id::text, r.name, u.password_hash, u.is_active,
		       COALESCE(u.mfa_enabled, false), u.totp_secret, COALESCE(u.mfa_backup_codes, '{}')
		FROM users u
		JOIN roles r ON r.id = u.role_id
		`+predicate, arg).Scan(&user.ID, &user.EmpID, &user.FullName, &user.Email, &entityID, &deptID, &locationID, &user.Role, &passwordHash, &user.IsActive,
		&user.MFAEnabled, &user.TOTPSecret, pq.Array(&user.MFABackupCodes))
	if err != nil {
		return user, err
	}
	user.EntityID = nullStringValue(entityID)
	user.DeptID = nullStringValue(deptID)
	user.LocationID = nullStringValue(locationID)
	user.PasswordHash = nullStringValue(passwordHash)
	return user, err
}

func (server *apiServer) fetchAsset(id string) (dbAsset, error) {
	var asset dbAsset
	err := server.db.QueryRow(`
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			COALESCE(maintenance_until::text, ''), status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets WHERE id = $1::uuid
	`, id).Scan(&asset.ID, &asset.AssetTag, &asset.Name, &asset.Hostname, &asset.Category, &asset.IsCompute, &asset.SerialNumber, &asset.Manufacturer, &asset.Model, &asset.EntityID, &asset.AssignedTo, &asset.DeptID, &asset.LocationID, &asset.PurchaseDate, &asset.Cost, &asset.WarrantyUntil, &asset.MaintenanceUntil, &asset.Status, &asset.Condition, &asset.GLPIID, &asset.SaltMinionID, &asset.WazuhAgentID, &asset.Notes)
	return asset, err
}

func (server *apiServer) fetchAssetByTerminalTarget(target string) (dbAsset, error) {
	var asset dbAsset
	err := server.db.QueryRow(`
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			COALESCE(maintenance_until::text, ''), status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets
		WHERE is_compute = TRUE AND (hostname = $1 OR salt_minion_id = $1 OR asset_tag = $1)
		LIMIT 1
	`, strings.TrimSpace(target)).Scan(&asset.ID, &asset.AssetTag, &asset.Name, &asset.Hostname, &asset.Category, &asset.IsCompute, &asset.SerialNumber, &asset.Manufacturer, &asset.Model, &asset.EntityID, &asset.AssignedTo, &asset.DeptID, &asset.LocationID, &asset.PurchaseDate, &asset.Cost, &asset.WarrantyUntil, &asset.MaintenanceUntil, &asset.Status, &asset.Condition, &asset.GLPIID, &asset.SaltMinionID, &asset.WazuhAgentID, &asset.Notes)
	return asset, err
}

func (server *apiServer) fetchAssetDetailBlocks(assetID string) (gin.H, gin.H, []gin.H, error) {
	details := gin.H{}
	network := gin.H{}
	software := make([]gin.H, 0)
	var processor, ram, storage, gpu, display, biosVersion, macAddress, osName, osVersion, kernel, architecture, osBuild, anydeskID, rustdeskID, diskLayout string
	var lastBoot, lastSeen sql.NullTime
	var pendingUpdates int
	var volumesRaw, loggedInUsersRaw []byte
	err := server.db.QueryRow(`
		SELECT COALESCE(processor, ''), COALESCE(ram, ''), COALESCE(storage, ''), COALESCE(gpu, ''), COALESCE(display, ''), COALESCE(bios_version, ''), COALESCE(mac_address, ''),
			COALESCE(os_name, ''), COALESCE(os_version, ''), COALESCE(kernel, ''), COALESCE(architecture, ''), COALESCE(os_build, ''), last_boot, last_seen, pending_updates,
			COALESCE(anydesk_id, ''), COALESCE(rustdesk_id, ''), COALESCE(disk_layout, ''), volumes_json, logged_in_users_json
		FROM asset_compute_details WHERE asset_id = $1::uuid
	`, assetID).Scan(&processor, &ram, &storage, &gpu, &display, &biosVersion, &macAddress, &osName, &osVersion, &kernel, &architecture, &osBuild, &lastBoot, &lastSeen, &pendingUpdates, &anydeskID, &rustdeskID, &diskLayout, &volumesRaw, &loggedInUsersRaw)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil, err
	}
	if err == nil {
		volumes := make([]any, 0)
		loggedInUsers := make([]string, 0)
		if len(volumesRaw) > 0 {
			_ = json.Unmarshal(volumesRaw, &volumes)
		}
		if len(loggedInUsersRaw) > 0 {
			_ = json.Unmarshal(loggedInUsersRaw, &loggedInUsers)
		}
		details = gin.H{"processor": emptyToNil(processor), "ram": emptyToNil(ram), "storage": emptyToNil(storage), "gpu": emptyToNil(gpu), "display": emptyToNil(display), "bios_version": emptyToNil(biosVersion), "mac_address": emptyToNil(macAddress), "os_name": emptyToNil(osName), "os_version": emptyToNil(osVersion), "kernel": emptyToNil(kernel), "architecture": emptyToNil(architecture), "os_build": emptyToNil(osBuild), "last_boot": nullTime(lastBoot), "last_seen": nullTime(lastSeen), "logged_in_users": loggedInUsers, "pending_updates": pendingUpdates, "anydesk_id": emptyToNil(anydeskID), "rustdesk_id": emptyToNil(rustdeskID), "disk_layout": emptyToNil(diskLayout), "volumes": volumes}
	}
	var wiredIP, wirelessIP, netbirdIP, dns, gateway string
	var statsRaw []byte
	err = server.db.QueryRow(`SELECT COALESCE(wired_ip::text, ''), COALESCE(wireless_ip::text, ''), COALESCE(netbird_ip::text, ''), COALESCE(dns, ''), COALESCE(gateway::text, ''), interface_stats FROM asset_network_snapshots WHERE asset_id = $1::uuid`, assetID).Scan(&wiredIP, &wirelessIP, &netbirdIP, &dns, &gateway, &statsRaw)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil, err
	}
	if err == nil {
		var stats any
		_ = json.Unmarshal(statsRaw, &stats)
		network = gin.H{"wired_ip": emptyToNil(wiredIP), "wireless_ip": emptyToNil(wirelessIP), "netbird_ip": emptyToNil(netbirdIP), "dns": emptyToNil(dns), "gateway": emptyToNil(gateway), "interface_stats": stats}
	}
	rows, err := server.db.Query(`SELECT id, name, COALESCE(version, ''), COALESCE(install_date::text, ''), COALESCE(source, '') FROM asset_software_inventory WHERE asset_id = $1::uuid ORDER BY name`, assetID)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, name, version, installDate, source string
		if err := rows.Scan(&id, &name, &version, &installDate, &source); err != nil {
			return nil, nil, nil, err
		}
		software = append(software, gin.H{"id": id, "name": name, "version": emptyToNil(version), "install_date": emptyToNil(installDate), "source": emptyToNil(source)})
	}
	return details, network, software, nil
}

func (server *apiServer) issueAuthResponse(c *gin.Context, user dbUser, method string) {
	token, err := server.issueToken(user)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "login", TargetType: "user", TargetID: user.ID, AuthMethod: method})
	httpx.JSON(c, http.StatusOK, authResponse{Token: token, User: server.userAuthPayload(user)})
}

func (server *apiServer) issueToken(user dbUser) (string, error) {
	return server.auth.IssueToken(authn.UserTokenInput{UserID: user.ID, EmpID: user.EmpID, Email: user.Email, Role: user.Role, EntityID: user.EntityID, DeptID: user.DeptID, Name: user.FullName})
}

func (server *apiServer) userAuthPayload(user dbUser) gin.H {
	portal := "/employee/dashboard"
	portals := []string{"employee"}
	if user.Role == "super_admin" {
		portal = "/admin/dashboard"
		portals = []string{"super_admin", "it_team", "employee"}
	} else if user.Role == "it_team" {
		portal = "/it/dashboard"
		portals = []string{"it_team", "employee"}
	} else if user.Role == "auditor" {
		portal = "/audit/dashboard"
		portals = []string{"auditor"}
	}
	return gin.H{"id": user.ID, "emp_id": user.EmpID, "email": user.Email, "full_name": user.FullName, "role": user.Role, "entity_id": user.EntityID, "dept_id": emptyToNil(user.DeptID), "location_id": emptyToNil(user.LocationID), "default_portal": portal, "portals": portals}
}

func (server *apiServer) collectAssetAlerts(ctx context.Context, asset dbAsset) ([]gin.H, error) {
	rows, err := server.db.QueryContext(ctx, `
		SELECT id, source, severity, title, COALESCE(detail, ''), is_resolved, 
		       COALESCE(resolved_at::text, ''), COALESCE(mttr_seconds, 0), created_at
		FROM asset_alerts
		WHERE asset_id = $1::uuid AND created_at >= NOW() - INTERVAL '7 days'
		ORDER BY created_at DESC
	`, asset.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id, source, severity, title, detail, resolvedAt string
		var resolved bool
		var mttrSeconds int
		var createdAt time.Time
		if err := rows.Scan(&id, &source, &severity, &title, &detail, &resolved, &resolvedAt, &mttrSeconds, &createdAt); err != nil {
			return nil, err
		}
		items = append(items, gin.H{
			"id":          id,
			"source":      source,
			"severity":    severity,
			"title":       title,
			"detail":      emptyToNil(detail),
			"resolved":    resolved,
			"resolved_at": emptyToNil(resolvedAt),
			"mttr_seconds": mttrSeconds,
			"created_at":  createdAt,
		})
	}

	return items, nil
}

func (server *apiServer) queuePatchRun(c *gin.Context, asset dbAsset, action string, state string, command string) (gin.H, error) {
	if strings.TrimSpace(asset.SaltMinionID) == "" {
		err := fmt.Errorf("salt minion is not linked for this asset")
		server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "salt_patch", "high", "Salt patch unavailable", err.Error())
		return nil, err
	}
	target := coalesceString(asset.SaltMinionID, asset.Hostname)
	if server.salt != nil && server.salt.Enabled() {
		connected, err := server.salt.TargetConnected(c.Request.Context(), target)
		if err != nil {
			server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "salt_patch", "high", "Salt patch connectivity check failed", err.Error())
			return nil, err
		}
		if !connected {
			err := fmt.Errorf("salt minion is not connected to the master for this asset")
			server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "salt_patch", "high", "Salt patch unavailable", err.Error())
			return nil, err
		}
	}
	tgtType := server.config.SaltTargetType
	if tgtType == "" {
		tgtType = "glob"
	}
	response := gin.H{"target": target, "tgt_type": tgtType}
	if server.salt == nil || !server.salt.Enabled() {
		err := fmt.Errorf("saltstack integration is not configured")
		server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "salt_patch", "high", "Salt patch unavailable", err.Error())
		return nil, err
	}

	definition, err := server.resolveAssetPatchDefinition(asset, action, state, command)
	if err != nil {
		return nil, err
	}
	response["action"] = definition.Action
	response["integration"] = definition.Integration
	response["component"] = definition.Component

	if definition.State != "" {
		result, err := server.salt.RunState(c.Request.Context(), target, definition.State)
		if err != nil {
			server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "salt_patch", "high", "Salt patch execution failed", err.Error())
			return nil, err
		}
		response["state"] = definition.State
		response["result"] = result
		response["status"] = patchRunStatus(response)
	} else {
		result, err := server.salt.RunCommand(c.Request.Context(), target, definition.Command)
		if err != nil {
			server.recordOperationalAlert(asset, middleware.CurrentClaims(c).UserID, "salt_patch", "high", "Salt patch execution failed", err.Error())
			return nil, err
		}
		response["command"] = definition.Command
		response["result"] = result
		response["status"] = commandRunStatus(result)
	}
	_, _ = server.recordAssetHistory(asset.ID, middleware.CurrentClaims(c).UserID, "patch_run", response)
	return response, nil
}

func patchRunStatus(detail map[string]any) string {
	if status := patchRunResultStatus(detail["result"]); status != "" {
		return status
	}

	status := strings.TrimSpace(strings.ToLower(fmt.Sprint(detail["status"])))
	if status == "" || status == "<nil>" {
		return "queued"
	}
	return status
}

func patchRunResultStatus(result any) string {
	resultMap, ok := result.(map[string]any)
	if !ok {
		return ""
	}

	returns, ok := resultMap["return"].([]any)
	if !ok {
		return ""
	}

	sawCompleted := false
	for _, item := range returns {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		for _, value := range entry {
			status, matched := patchRunReturnStatus(value)
			if !matched {
				continue
			}
			if status == "failed" {
				return status
			}
			if status == "completed" {
				sawCompleted = true
			}
		}
	}

	if sawCompleted {
		return "completed"
	}
	return ""
}

func patchRunReturnStatus(value any) (string, bool) {
	switch typed := value.(type) {
	case bool:
		if typed {
			return "completed", true
		}
		return "failed", true
	case string:
		if strings.TrimSpace(typed) != "" {
			return "failed", true
		}
	case []any:
		for _, item := range typed {
			if strings.TrimSpace(fmt.Sprint(item)) != "" {
				return "failed", true
			}
		}
	case map[string]any:
		sawStateResult := false
		for _, item := range typed {
			stateResult, ok := item.(map[string]any)
			if !ok {
				continue
			}
			resultValue, ok := stateResult["result"].(bool)
			if !ok {
				continue
			}
			sawStateResult = true
			if !resultValue {
				return "failed", true
			}
		}
		if sawStateResult {
			return "completed", true
		}
	}

	return "", false
}

func (server *apiServer) buildTerminalPayload(asset dbAsset) (gin.H, error) {
	minionID := coalesceString(asset.SaltMinionID, asset.Hostname)
	url := ""
	if server.salt != nil && server.salt.Enabled() {
		connected, err := server.salt.TargetConnected(context.Background(), minionID)
		if err != nil {
			return nil, err
		}
		if !connected {
			return nil, fmt.Errorf("salt minion is not connected to the master for this asset")
		}
	}
	if url == "" {
		base := strings.TrimRight(server.config.PublicServerURL, "/")
		if base == "" {
			base = strings.TrimRight(server.config.FrontendOrigin, "/")
		}
		url = fmt.Sprintf("%s/terminal/%s", base, minionID)
	}
	return gin.H{"url": url, "minion_id": minionID}, nil
}

func (server *apiServer) parseGoogleIDToken(idToken string) (struct{ Email string }, error) {
	requestContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(strings.TrimSpace(idToken))
	request, err := http.NewRequestWithContext(requestContext, http.MethodGet, endpoint, nil)
	if err != nil {
		return struct{ Email string }{}, err
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return struct{ Email string }{}, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return struct{ Email string }{}, fmt.Errorf("google token verification failed: %s", strings.TrimSpace(string(body)))
	}

	var claims struct {
		Email         string `json:"email"`
		Audience      string `json:"aud"`
		HostedDomain  string `json:"hd"`
		EmailVerified string `json:"email_verified"`
	}
	if err := json.NewDecoder(response.Body).Decode(&claims); err != nil {
		return struct{ Email string }{}, err
	}
	if server.config.GoogleClientID != "" && claims.Audience != server.config.GoogleClientID {
		return struct{ Email string }{}, fmt.Errorf("unexpected google client id")
	}
	if claims.Email == "" || !strings.EqualFold(claims.EmailVerified, "true") {
		return struct{ Email string }{}, fmt.Errorf("google email is not verified")
	}
	if server.config.GoogleHostedDomain != "" && !strings.EqualFold(claims.HostedDomain, server.config.GoogleHostedDomain) {
		return struct{ Email string }{}, fmt.Errorf("non-zerodha domain is not allowed")
	}
	return struct{ Email string }{Email: claims.Email}, nil
}

func (server *apiServer) websocketOriginAllowed(requestOrigin string) bool {
	requestOrigin = strings.TrimSpace(requestOrigin)
	if requestOrigin == "" {
		return true
	}
	for _, candidate := range server.config.FrontendOrigins() {
		if requestOrigin == candidate {
			return true
		}
	}
	return false
}

func extractWebSocketBearerToken(request *http.Request) string {
	for _, protocol := range websocketSubprotocols(request) {
		if encoded, ok := strings.CutPrefix(protocol, "bearer."); ok {
			decoded, err := base64.RawURLEncoding.DecodeString(encoded)
			if err == nil {
				return strings.TrimSpace(string(decoded))
			}
		}
	}
	return ""
}

func websocketSubprotocols(request *http.Request) []string {
	values := request.Header.Values("Sec-WebSocket-Protocol")
	protocols := make([]string, 0)
	for _, value := range values {
		for _, protocol := range strings.Split(value, ",") {
			trimmed := strings.TrimSpace(protocol)
			if trimmed != "" {
				protocols = append(protocols, trimmed)
			}
		}
	}
	return protocols
}

func selectChatSubprotocol(request *http.Request) string {
	for _, protocol := range websocketSubprotocols(request) {
		if protocol == "itms.chat.v1" {
			return protocol
		}
	}
	return ""
}

func selectAnnouncementSubprotocol(request *http.Request) string {
	for _, protocol := range websocketSubprotocols(request) {
		if protocol == "itms.announcements.v1" {
			return protocol
		}
	}
	return ""
}

func bindJSONWithLimit(c *gin.Context, target any, maxBytes int64) error {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
	return c.ShouldBindJSON(target)
}

func authLimiterKey(c *gin.Context, identifier string) string {
	clientIP := strings.TrimSpace(c.ClientIP())
	identifier = strings.ToLower(strings.TrimSpace(identifier))
	if identifier == "" {
		return clientIP
	}
	return clientIP + ":" + identifier
}

func newAuthAttemptLimiter(window time.Duration, maxFailures int, blockDuration time.Duration) *authAttemptLimiter {
	return &authAttemptLimiter{
		entries:       make(map[string]authAttemptEntry),
		window:        window,
		maxFailures:   maxFailures,
		blockDuration: blockDuration,
	}
}

func (limiter *authAttemptLimiter) Allow(key string) bool {
	if limiter == nil || key == "" {
		return true
	}
	now := time.Now().UTC()
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	entry := limiter.pruneLocked(key, now)
	if entry.blockedUntil.After(now) {
		limiter.entries[key] = entry
		return false
	}
	limiter.entries[key] = entry
	return true
}

func (limiter *authAttemptLimiter) RegisterFailure(key string) {
	if limiter == nil || key == "" {
		return
	}
	now := time.Now().UTC()
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	entry := limiter.pruneLocked(key, now)
	entry.failures = append(entry.failures, now)
	if len(entry.failures) >= limiter.maxFailures {
		entry.blockedUntil = now.Add(limiter.blockDuration)
		entry.failures = entry.failures[:0]
	}
	limiter.entries[key] = entry
}

func (limiter *authAttemptLimiter) Reset(key string) {
	if limiter == nil || key == "" {
		return
	}
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	delete(limiter.entries, key)
}

func (limiter *authAttemptLimiter) pruneLocked(key string, now time.Time) authAttemptEntry {
	entry := limiter.entries[key]
	if entry.blockedUntil.Before(now) {
		entry.blockedUntil = time.Time{}
	}
	if len(entry.failures) == 0 {
		return entry
	}
	kept := entry.failures[:0]
	cutoff := now.Add(-limiter.window)
	for _, failure := range entry.failures {
		if failure.After(cutoff) {
			kept = append(kept, failure)
		}
	}
	entry.failures = kept
	return entry
}

func (server *apiServer) requireRoles(c *gin.Context, allowed ...string) bool {
	return middleware.RequireRoles(c, allowed...)
}

func (server *apiServer) entityAllowed(c *gin.Context, entityID string) bool {
	return server.entityAllowedByID(c, entityID)
}

func (server *apiServer) entityAllowedByID(c *gin.Context, entityID string) bool {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		return false
	}
	if claims.Role == "super_admin" {
		return true
	}
	if claims.EntityID == entityID {
		return true
	}
	var exists bool
	_ = server.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM user_entity_access WHERE user_id = $1::uuid AND entity_id = $2::uuid)`, claims.UserID, entityID).Scan(&exists)
	return exists
}

func (server *apiServer) userVisibleByEntity(c *gin.Context, entityID string, userID string) bool {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		return false
	}
	if claims.Role == "employee" {
		return claims.UserID == userID
	}
	return server.entityAllowedByID(c, entityID)
}

func (server *apiServer) assetAllowed(c *gin.Context, entityID string, assignedTo string) bool {
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		return false
	}
	if claims.Role == "employee" {
		return claims.UserID == assignedTo
	}
	return server.entityAllowedByID(c, entityID)
}

func (server *apiServer) validateEntityLinks(entityID string, deptID string, locationID string) error {
	if entityID == "" {
		return fmt.Errorf("entity_id is required")
	}
	if deptID != "" {
		var exists bool
		if err := server.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM departments WHERE id = $1::uuid AND entity_id = $2::uuid)`, deptID, entityID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("department does not belong to the selected entity")
		}
	}
	if locationID != "" {
		var exists bool
		if err := server.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1::uuid AND entity_id = $2::uuid)`, locationID, entityID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("location does not belong to the selected entity")
		}
	}
	return nil
}

func (server *apiServer) allocateHostname(ctx context.Context, entityID string, deptID string) (string, error) {
	_ = ctx
	tx, err := server.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	hostname, err := allocateHostnameTx(tx, entityID, deptID, true)
	if err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return hostname, nil
}

func (server *apiServer) peekHostname(ctx context.Context, entityID string, deptID string) (string, error) {
	_ = ctx
	tx, err := server.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	return allocateHostnameTx(tx, entityID, deptID, false)
}

func allocateHostnameTx(tx *sql.Tx, entityID string, deptID string, increment bool) (string, error) {
	var entityCode, deptCode string
	if err := tx.QueryRow(`SELECT lower(short_code) FROM entities WHERE id = $1::uuid`, entityID).Scan(&entityCode); err != nil {
		return "", fmt.Errorf("load entity prefix: %w", err)
	}
	if err := tx.QueryRow(`SELECT lower(short_code) FROM departments WHERE id = $1::uuid AND entity_id = $2::uuid`, deptID, entityID).Scan(&deptCode); err != nil {
		return "", fmt.Errorf("load department short code: %w", err)
	}
	deptCode = normalizeHostnameComponent(deptCode)
	if deptCode == "" {
		return "", fmt.Errorf("department short code is invalid")
	}
	var nextSeq int
	if err := tx.QueryRow(`
		INSERT INTO hostname_sequences (entity_id, dept_id, next_seq)
		VALUES ($1::uuid, $2::uuid, 1)
		ON CONFLICT (entity_id, dept_id) DO UPDATE SET next_seq = hostname_sequences.next_seq
		RETURNING next_seq
	`, entityID, deptID).Scan(&nextSeq); err != nil {
		return "", fmt.Errorf("allocate hostname sequence: %w", err)
	}
	hostname := fmt.Sprintf("%s-%s-%03d", entityCode, deptCode, nextSeq)
	if increment {
		if _, err := tx.Exec(`UPDATE hostname_sequences SET next_seq = $3, updated_at = NOW() WHERE entity_id = $1::uuid AND dept_id = $2::uuid`, entityID, deptID, nextSeq+1); err != nil {
			return "", fmt.Errorf("advance hostname sequence: %w", err)
		}
	}
	return hostname, nil
}

func (server *apiServer) recordAssetHistory(assetID string, actorID string, action string, detail any) (string, error) {
	payload, _ := json.Marshal(detail)
	var id string
	err := server.db.QueryRow(`INSERT INTO asset_history (asset_id, actor_id, action, detail) VALUES ($1::uuid, NULLIF($2, '')::uuid, $3, $4::jsonb) RETURNING id`, assetID, actorID, action, string(payload)).Scan(&id)
	return id, err
}

func (server *apiServer) recordAuditLog(c *gin.Context, meta middleware.AuditMeta) error {
	claims := middleware.CurrentClaims(c)
	actorID := meta.ActorID
	entityID := meta.EntityID
	if actorID == "" && claims != nil {
		actorID = claims.UserID
	}
	if entityID == "" && claims != nil {
		entityID = claims.EntityID
	}
	detail := meta.Detail
	if detail == nil {
		if body, exists := c.Get(middleware.AuditBodyKey); exists {
			detail = gin.H{"request": body}
		}
	}
	payload, _ := json.Marshal(detail)
	clientIP := strings.TrimSpace(c.GetHeader("X-Forwarded-For"))
	if clientIP != "" {
		parts := strings.Split(clientIP, ",")
		clientIP = strings.TrimSpace(parts[0])
	} else {
		clientIP = c.ClientIP()
	}
	_, err := server.db.Exec(`
		INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
		VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
	`, actorID, entityID, meta.Action, meta.TargetType, meta.TargetID, string(payload), clientIP, meta.AuthMethod)
	return err
}

func (server *apiServer) recordOperationalAlert(asset dbAsset, fallbackUserID string, source string, severity string, title string, detail string) {
	alertUserID := strings.TrimSpace(asset.AssignedTo)
	if alertUserID == "" {
		alertUserID = strings.TrimSpace(fallbackUserID)
	}
	if alertUserID == "" || strings.TrimSpace(asset.ID) == "" {
		return
	}

	// Skip alert recording if asset is in maintenance window
	if strings.TrimSpace(asset.MaintenanceUntil) != "" {
		maintenanceUntil, err := time.Parse(time.RFC3339, strings.TrimSpace(asset.MaintenanceUntil))
		if err == nil && time.Now().UTC().Before(maintenanceUntil) {
			// Asset is in maintenance mode, suppress alert
			return
		}
	}

	var existingID string
	err := server.db.QueryRow(`
		SELECT id
		FROM alerts
		WHERE user_id = $1::uuid
		  AND device_id = $2::uuid
		  AND lower(source) = lower($3)
		  AND lower(title) = lower($4)
		  AND COALESCE(detail, '') = $5
		  AND resolved = FALSE
		  AND created_at >= NOW() - INTERVAL '12 hours'
		ORDER BY created_at DESC
		LIMIT 1
	`, alertUserID, asset.ID, source, title, strings.TrimSpace(detail)).Scan(&existingID)
	if err == nil {
		return
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return
	}

	_, _ = server.db.Exec(`
		INSERT INTO alerts (user_id, device_id, source, severity, title, detail, acknowledged, resolved, created_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, NULLIF($6, ''), FALSE, FALSE, NOW())
	`, alertUserID, asset.ID, source, severity, title, strings.TrimSpace(detail))
}

func normalizeSecurityAlertSource(source string) string {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "salt", "salt_patch", "patch":
		return "patch"
	case "openscap", "open_scap", "hardening":
		return "openscap"
	case "clamav", "clam", "clamwin", "clamscan":
		return "clamav"
	case "inotify", "inotifywait", "file_integrity", "fim":
		return "inotify"
	case "terminal", "terminal_session":
		return "terminal"
	default:
		return strings.ToLower(strings.TrimSpace(source))
	}
}

func parseInventoryReportTime(value string) time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Now().UTC()
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return time.Now().UTC()
	}
	return parsed.UTC()
}

func inventorySecurityAlertDetail(report inventorysync.SecurityReport) string {
	lines := make([]string, 0, 6)
	if summary := strings.TrimSpace(report.Summary); summary != "" {
		lines = append(lines, summary)
	}
	if detail := strings.TrimSpace(report.Detail); detail != "" {
		lines = append(lines, detail)
	}
	metrics := make([]string, 0, 3)
	if report.ScannedFileCount > 0 {
		metrics = append(metrics, fmt.Sprintf("Scanned files: %d", report.ScannedFileCount))
	}
	if report.InfectedFileCount > 0 {
		metrics = append(metrics, fmt.Sprintf("Infected files: %d", report.InfectedFileCount))
	}
	if report.ErrorCount > 0 {
		metrics = append(metrics, fmt.Sprintf("Errors: %d", report.ErrorCount))
	}
	if len(metrics) > 0 {
		lines = append(lines, strings.Join(metrics, " • "))
	}
	if len(report.ScannedPaths) > 0 {
		lines = append(lines, "Paths: "+strings.Join(report.ScannedPaths, ", "))
	}
	if len(report.ArtifactFiles) > 0 {
		lines = append(lines, "Artifacts: "+strings.Join(report.ArtifactFiles, ", "))
	}
	if len(report.InfectedFiles) > 0 {
		infectedFiles := report.InfectedFiles
		if len(infectedFiles) > 12 {
			infectedFiles = infectedFiles[:12]
		}
		lines = append(lines, "Detected files:\n- "+strings.Join(infectedFiles, "\n- "))
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func inventorySecurityAlertPresentation(report inventorysync.SecurityReport) (string, string, string, string, time.Time) {
	source := normalizeSecurityAlertSource(report.Source)
	status := strings.ToLower(strings.TrimSpace(report.Status))
	severity := strings.ToLower(strings.TrimSpace(report.Severity))
	title := strings.TrimSpace(report.Title)
	if severity == "" {
		switch status {
		case "infected", "failed":
			severity = "high"
		case "error", "warning":
			severity = "warning"
		default:
			severity = "info"
		}
	}
	if title == "" {
		switch source {
		case "clamav":
			switch status {
			case "infected":
				title = "ClamAV detected threats"
			case "error", "failed":
				title = "ClamAV scan failed"
			default:
				title = "ClamAV scan clean"
			}
		case "openscap":
			title = "OpenSCAP hardening report"
		default:
			title = strings.TrimSpace(report.Title)
			if title == "" {
				title = strings.ToUpper(source) + " report"
			}
		}
	}
	detail := inventorySecurityAlertDetail(report)
	if detail == "" {
		detail = title
	}
	return source, severity, title, detail, parseInventoryReportTime(report.ScannedAt)
}

func (server *apiServer) defaultAlertRecipientID(ctx context.Context) string {
	var userID string
	err := server.db.QueryRowContext(ctx, `
		SELECT u.id::text
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.is_active = TRUE AND r.name IN ('super_admin', 'it_team')
		ORDER BY CASE WHEN r.name = 'super_admin' THEN 0 ELSE 1 END, u.full_name ASC
		LIMIT 1
	`).Scan(&userID)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(userID)
}

func (server *apiServer) fetchAssetByTag(ctx context.Context, assetTag string) (dbAsset, error) {
	var asset dbAsset
	err := server.db.QueryRowContext(ctx, `
		SELECT id, asset_tag, name, COALESCE(hostname, ''), category, is_compute, COALESCE(serial_number, ''), COALESCE(manufacturer, ''), COALESCE(model, ''), entity_id::text,
			COALESCE(assigned_to::text, ''), COALESCE(dept_id::text, ''), COALESCE(location_id::text, ''), COALESCE(purchase_date::text, ''), COALESCE(cost::text, ''), COALESCE(warranty_until::text, ''),
			COALESCE(maintenance_until::text, ''), status, condition, COALESCE(glpi_id, 0), COALESCE(salt_minion_id, ''), COALESCE(wazuh_agent_id, ''), COALESCE(notes, '')
		FROM assets
		WHERE asset_tag = $1
		LIMIT 1
	`, strings.TrimSpace(assetTag)).Scan(&asset.ID, &asset.AssetTag, &asset.Name, &asset.Hostname, &asset.Category, &asset.IsCompute, &asset.SerialNumber, &asset.Manufacturer, &asset.Model, &asset.EntityID, &asset.AssignedTo, &asset.DeptID, &asset.LocationID, &asset.PurchaseDate, &asset.Cost, &asset.WarrantyUntil, &asset.MaintenanceUntil, &asset.Status, &asset.Condition, &asset.GLPIID, &asset.SaltMinionID, &asset.WazuhAgentID, &asset.Notes)
	return asset, err
}

func (server *apiServer) resolveInventorySecurityAsset(ctx context.Context, asset inventorysync.Asset) (dbAsset, error) {
	return server.fetchAssetByTag(ctx, asset.AssetTag)
}

func (server *apiServer) resolveExistingAssetAlert(ctx context.Context, assetID string, source string, title string, detail string) string {
	var alertID string
	err := server.db.QueryRowContext(ctx, `
		SELECT id::text
		FROM asset_alerts
		WHERE asset_id = $1::uuid
		  AND lower(source) = lower($2)
		  AND lower(title) = lower($3)
		  AND COALESCE(detail, '') = $4
		  AND is_resolved = FALSE
		  AND created_at >= NOW() - INTERVAL '20 hours'
		ORDER BY created_at DESC
		LIMIT 1
	`, assetID, source, title, strings.TrimSpace(detail)).Scan(&alertID)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(alertID)
}

func (server *apiServer) resolveExistingUserAlert(ctx context.Context, userID string, assetID string, source string, title string, detail string) string {
	var alertID string
	err := server.db.QueryRowContext(ctx, `
		SELECT id::text
		FROM alerts
		WHERE user_id = $1::uuid
		  AND device_id = $2::uuid
		  AND lower(source) = lower($3)
		  AND lower(title) = lower($4)
		  AND COALESCE(detail, '') = $5
		  AND resolved = FALSE
		  AND created_at >= NOW() - INTERVAL '20 hours'
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, assetID, source, title, strings.TrimSpace(detail)).Scan(&alertID)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(alertID)
}

func (server *apiServer) persistInventorySecurityReports(ctx context.Context, asset inventorysync.Asset) error {
	if len(asset.SecurityReports) == 0 {
		return nil
	}
	resolvedAsset, err := server.resolveInventorySecurityAsset(ctx, asset)
	if err != nil {
		return err
	}
	for _, report := range asset.SecurityReports {
		source, severity, title, detail, createdAt := inventorySecurityAlertPresentation(report)
		if strings.TrimSpace(source) == "" || strings.TrimSpace(title) == "" {
			continue
		}
		status := strings.ToLower(strings.TrimSpace(report.Status))
		if source == "clamav" && status == "clean" {
			_, _ = server.db.ExecContext(ctx, `
				UPDATE asset_alerts 
				SET is_resolved = TRUE, 
				    resolved_at = NOW(), 
				    mttr_seconds = EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER
				WHERE asset_id = $1::uuid 
				  AND lower(source) = 'clamav' 
				  AND is_resolved = FALSE
			`, resolvedAsset.ID)
			_, _ = server.db.ExecContext(ctx, `UPDATE alerts SET resolved = TRUE WHERE device_id = $1::uuid AND lower(source) = 'clamav' AND resolved = FALSE`, resolvedAsset.ID)
		}
		if server.resolveExistingAssetAlert(ctx, resolvedAsset.ID, source, title, detail) == "" {
			if _, err := server.db.ExecContext(ctx, `
				INSERT INTO asset_alerts (asset_id, source, severity, title, detail, is_resolved, created_at)
				VALUES ($1::uuid, $2, $3, $4, NULLIF($5, ''), FALSE, $6)
			`, resolvedAsset.ID, source, severity, title, strings.TrimSpace(detail), createdAt); err != nil {
				return err
			}
		}
		alertUserID := strings.TrimSpace(resolvedAsset.AssignedTo)
		if alertUserID == "" {
			alertUserID = server.defaultAlertRecipientID(ctx)
		}
		if alertUserID == "" {
			continue
		}
		if server.resolveExistingUserAlert(ctx, alertUserID, resolvedAsset.ID, source, title, detail) != "" {
			continue
		}
		if _, err := server.db.ExecContext(ctx, `
			INSERT INTO alerts (user_id, device_id, source, severity, title, detail, acknowledged, resolved, created_at)
			VALUES ($1::uuid, $2::uuid, $3, $4, $5, NULLIF($6, ''), FALSE, FALSE, $7)
		`, alertUserID, resolvedAsset.ID, source, severity, title, strings.TrimSpace(detail), createdAt); err != nil {
			return err
		}
	}
	return nil
}

func wazuhAlertSeverity(level string) string {
	value := strings.ToLower(strings.TrimSpace(level))
	switch value {
	case "critical", "high", "12", "13", "14", "15", "16":
		return "high"
	case "warning", "medium", "8", "9", "10", "11":
		return "medium"
	case "low", "info", "1", "2", "3", "4", "5", "6", "7":
		return "warning"
	default:
		return "warning"
	}
}

func parseRemoteAlertTime(value string) time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Now().UTC()
	}
	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return parsed.UTC()
	}
	if parsed, err := time.Parse("2006-01-02T15:04:05-07:00", trimmed); err == nil {
		return parsed.UTC()
	}
	return time.Now().UTC()
}

func (server *apiServer) persistInventoryWazuhFindings(ctx context.Context, asset inventorysync.Asset) error {
	if server.wazuh == nil || !server.wazuh.Enabled() || strings.TrimSpace(asset.WazuhAgentID) == "" {
		return nil
	}
	resolvedAsset, err := server.resolveInventorySecurityAsset(ctx, asset)
	if err != nil {
		return err
	}
	findings, err := server.wazuh.ListAgentAlerts(ctx, strings.TrimSpace(asset.WazuhAgentID), 5)
	if err != nil {
		return err
	}
	for _, finding := range findings {
		title := strings.TrimSpace(finding.Title)
		if title == "" {
			continue
		}
		detail := strings.TrimSpace(finding.Detail)
		severity := wazuhAlertSeverity(finding.Level)
		createdAt := parseRemoteAlertTime(finding.CreatedAt)
		if server.resolveExistingAssetAlert(ctx, resolvedAsset.ID, "wazuh", title, detail) == "" {
			if _, err := server.db.ExecContext(ctx, `
				INSERT INTO asset_alerts (asset_id, source, severity, title, detail, is_resolved, created_at)
				VALUES ($1::uuid, 'wazuh', $2, $3, NULLIF($4, ''), FALSE, $5)
			`, resolvedAsset.ID, severity, title, detail, createdAt); err != nil {
				return err
			}
		}
		alertUserID := strings.TrimSpace(resolvedAsset.AssignedTo)
		if alertUserID == "" {
			alertUserID = server.defaultAlertRecipientID(ctx)
		}
		if alertUserID == "" || server.resolveExistingUserAlert(ctx, alertUserID, resolvedAsset.ID, "wazuh", title, detail) != "" {
			continue
		}
		if _, err := server.db.ExecContext(ctx, `
			INSERT INTO alerts (user_id, device_id, source, severity, title, detail, acknowledged, resolved, created_at)
			VALUES ($1::uuid, $2::uuid, 'wazuh', $3, $4, NULLIF($5, ''), FALSE, FALSE, $6)
		`, alertUserID, resolvedAsset.ID, severity, title, detail, createdAt); err != nil {
			return err
		}
	}
	return nil
}

func userIsActive(user dbUser) bool { return user.IsActive }

func normalizeHostnameComponent(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "_", "-")
	value = regexp.MustCompile(`[^a-z0-9-]+`).ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	value = regexp.MustCompile(`-+`).ReplaceAllString(value, "-")
	return value
}

func emptyToNil(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func emptyToNullString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func nullTime(value sql.NullTime) any {
	if !value.Valid {
		return nil
	}
	return value.Time
}

func zeroToNil(value int) any {
	if value == 0 {
		return nil
	}
	return value
}

func derefInt(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func coalesceString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return strings.TrimSpace(fallback)
	}
	return strings.TrimSpace(value)
}

func decodeJWTPart(part string) ([]byte, error) {
	part = strings.ReplaceAll(part, "-", "+")
	part = strings.ReplaceAll(part, "_", "/")
	switch len(part) % 4 {
	case 2:
		part += "=="
	case 3:
		part += "="
	}
	return base64.StdEncoding.DecodeString(part)
}
