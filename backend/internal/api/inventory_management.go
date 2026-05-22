package api

import (
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

type inventoryBranchStockInput struct {
	BranchID  string `json:"branchId"`
	Quantity  int    `json:"quantity"`
	BranchName string `json:"branchName"`
}

func inventoryCodeToken(value string, fallback string, maxLength int) string {
	var builder strings.Builder
	for _, character := range strings.ToUpper(strings.TrimSpace(value)) {
		if (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9') {
			builder.WriteRune(character)
		}
	}
	token := builder.String()
	if token == "" {
		token = fallback
	}
	if len(token) > maxLength {
		token = token[:maxLength]
	}
	return token
}

func (server *apiServer) inventoryMainItemExists(name string, excludeID string) (bool, error) {
	query := `SELECT EXISTS (SELECT 1 FROM items WHERE lower(name) = lower($1))`
	args := []any{strings.TrimSpace(name)}
	if excludeID != "" {
		query = `SELECT EXISTS (SELECT 1 FROM items WHERE lower(name) = lower($1) AND id <> $2::uuid)`
		args = append(args, excludeID)
	}
	var exists bool
	if err := server.db.QueryRow(query, args...).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (server *apiServer) inventorySubItemExists(itemID string, name string, excludeID string) (bool, error) {
	query := `SELECT EXISTS (SELECT 1 FROM sub_items WHERE item_id = $1::uuid AND lower(name) = lower($2))`
	args := []any{strings.TrimSpace(itemID), strings.TrimSpace(name)}
	if excludeID != "" {
		query = `SELECT EXISTS (SELECT 1 FROM sub_items WHERE item_id = $1::uuid AND lower(name) = lower($2) AND id <> $3::uuid)`
		args = append(args, excludeID)
	}
	var exists bool
	if err := server.db.QueryRow(query, args...).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (server *apiServer) inventoryItemCodeExists(itemCode string, excludeID string) (bool, error) {
	normalizedCode := strings.TrimSpace(strings.ToUpper(itemCode))
	query := `SELECT EXISTS (SELECT 1 FROM sub_items WHERE item_code = $1)`
	args := []any{normalizedCode}
	if excludeID != "" {
		query = `SELECT EXISTS (SELECT 1 FROM sub_items WHERE item_code = $1 AND id <> $2::uuid)`
		args = append(args, excludeID)
	}
	var exists bool
	if err := server.db.QueryRow(query, args...).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (server *apiServer) generateInventorySubItemCode(itemID string, subItemName string) (string, error) {
	var itemName string
	if err := server.db.QueryRow(`SELECT name FROM items WHERE id = $1::uuid`, itemID).Scan(&itemName); err != nil {
		return "", err
	}
	base := inventoryCodeToken(itemName, "ITEM", 4) + "-" + inventoryCodeToken(subItemName, "SUBITEM", 20)
	for index := 0; index < 1000; index++ {
		suffix := ""
		if index > 0 {
			suffix = fmt.Sprintf("-%d", index+1)
		}
		candidate := base
		if len(candidate)+len(suffix) > 32 {
			candidate = candidate[:32-len(suffix)]
		}
		candidate += suffix
		exists, err := server.inventoryItemCodeExists(candidate, "")
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("failed to generate unique item code")
}

func normalizeInventoryAssetType(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "critical" {
		return "critical"
	}
	return "non_critical"
}

func (server *apiServer) inventoryModuleOptions(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	items, err := server.simpleLookup(`SELECT id, name FROM items ORDER BY name`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	suppliers, err := server.simpleLookup(`SELECT id, name FROM suppliers ORDER BY name`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	branchesQuery := `SELECT id, full_name AS name FROM locations ORDER BY full_name`
	branchArgs := []any(nil)
	if claims.Role != "super_admin" {
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
	branches, err := server.simpleLookupArgs(branchesQuery, branchArgs...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	subRows, err := server.db.Query(`
		SELECT si.id, si.item_id::text, si.name, si.item_code, COALESCE(si.company_name, ''), COALESCE(si.supplier_id::text, ''), COALESCE(si.operating_system, ''), COALESCE(si.asset_type, 'non_critical'), COALESCE(si.specs_remarks, '')
		FROM sub_items si
		ORDER BY si.name
	`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer subRows.Close()
	subItems := make([]gin.H, 0)
	for subRows.Next() {
		var id, itemID, name, itemCode, companyName, supplierID, operatingSystem, assetType, remarks string
		if err := subRows.Scan(&id, &itemID, &name, &itemCode, &companyName, &supplierID, &operatingSystem, &assetType, &remarks); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		subItems = append(subItems, gin.H{
			"id": id,
			"itemId": itemID,
			"name": name,
			"itemCode": itemCode,
			"companyName": emptyToNil(companyName),
			"supplierId": emptyToNil(supplierID),
			"operatingSystem": emptyToNil(operatingSystem),
			"assetType": normalizeInventoryAssetType(assetType),
			"remarks": emptyToNil(remarks),
		})
	}

	defaultCompanyName := ""
	if claims.EntityID != "" {
		_ = server.db.QueryRow(`SELECT COALESCE(full_name, '') FROM entities WHERE id = $1::uuid`, claims.EntityID).Scan(&defaultCompanyName)
	}
	userQuery := `
		SELECT u.id, u.full_name, COALESCE(u.email, ''), COALESCE(u.emp_id, ''), COALESCE(l.full_name, '')
		FROM users u
		LEFT JOIN locations l ON l.id = u.location_id
		WHERE u.is_active = TRUE
		ORDER BY u.full_name
	`
	userArgs := []any(nil)
	if claims.Role != "super_admin" {
		userQuery = `
			SELECT u.id, u.full_name, COALESCE(u.email, ''), COALESCE(u.emp_id, ''), COALESCE(l.full_name, '')
			FROM users u
			LEFT JOIN locations l ON l.id = u.location_id
			WHERE u.is_active = TRUE
			  AND (
			      u.entity_id = $1::uuid
			      OR EXISTS (
			          SELECT 1 FROM user_entity_access uea
			          WHERE uea.user_id = $2::uuid AND uea.entity_id = u.entity_id
			      )
			  )
			ORDER BY u.full_name
		`
		userArgs = []any{claims.EntityID, claims.UserID}
	}
	userRows, err := server.db.Query(userQuery, userArgs...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer userRows.Close()
	employees := make([]gin.H, 0)
	for userRows.Next() {
		var id, fullName, email, empID, branchName string
		if err := userRows.Scan(&id, &fullName, &email, &empID, &branchName); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		employees = append(employees, gin.H{"id": id, "name": fullName, "email": emptyToNil(email), "empId": emptyToNil(empID), "branchName": emptyToNil(branchName)})
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"items": items,
		"subItems": subItems,
		"suppliers": suppliers,
		"branches": branches,
		"defaultCompanyName": emptyToNil(defaultCompanyName),
		"employees": employees,
	})
}

func inventoryStockQueryMap(server *apiServer, subItemIDs []string) (map[string][]gin.H, map[string]int, error) {
	stockBySubItem := map[string][]gin.H{}
	totals := map[string]int{}
	if len(subItemIDs) == 0 {
		return stockBySubItem, totals, nil
	}
	args := make([]any, 0, len(subItemIDs))
	placeholders := make([]string, 0, len(subItemIDs))
	for index, id := range subItemIDs {
		placeholders = append(placeholders, fmt.Sprintf("$%d::uuid", index+1))
		args = append(args, id)
	}
	rows, err := server.db.Query(`
		SELECT s.sub_item_id::text, s.branch_id::text, l.full_name, s.quantity
		FROM inventory_stock s
		JOIN locations l ON l.id = s.branch_id
		WHERE s.sub_item_id IN (`+strings.Join(placeholders, ", ")+`)
		ORDER BY l.full_name
	`, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var subItemID, branchID, branchName string
		var quantity int
		if err := rows.Scan(&subItemID, &branchID, &branchName, &quantity); err != nil {
			return nil, nil, err
		}
		stockBySubItem[subItemID] = append(stockBySubItem[subItemID], gin.H{"branchId": branchID, "branchName": branchName, "quantity": quantity})
		totals[subItemID] += quantity
	}
	return stockBySubItem, totals, rows.Err()
}

func (server *apiServer) inventoryModuleAssets(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	page, pageSize, paginate := parsePaginationRequest(c, 20)
	search := strings.ToLower(strings.TrimSpace(c.Query("search")))
	mainItemID := strings.TrimSpace(c.Query("mainItemId"))
	subItemID := strings.TrimSpace(c.Query("subItemId"))
	branchID := strings.TrimSpace(c.Query("branchId"))
	assetType := normalizeInventoryAssetType(c.Query("assetType"))
	whereClauses := []string{"1 = 1"}
	args := make([]any, 0, 8)
	argIndex := 1
	if claims.Role != "super_admin" {
		whereClauses = append(whereClauses, fmt.Sprintf("(COALESCE(branch.entity_id, location.entity_id, assignee.entity_id) = $%d::uuid OR EXISTS (SELECT 1 FROM user_entity_access uea WHERE uea.user_id = $%d::uuid AND uea.entity_id = COALESCE(branch.entity_id, location.entity_id, assignee.entity_id)))", argIndex, argIndex+1))
		args = append(args, claims.EntityID, claims.UserID)
		argIndex += 2
	}
	if mainItemID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("si.item_id = $%d::uuid", argIndex))
		args = append(args, mainItemID)
		argIndex++
	}
	if subItemID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("s.sub_item_id = $%d::uuid", argIndex))
		args = append(args, subItemID)
		argIndex++
	}
	if branchID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(s.branch_id = $%d::uuid OR EXISTS (SELECT 1 FROM inventory_stock ist WHERE ist.sub_item_id = s.sub_item_id AND ist.branch_id = $%d::uuid))", argIndex, argIndex))
		args = append(args, branchID)
		argIndex++
	}
	if c.Query("assetType") != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("COALESCE(NULLIF(lower(s.asset_type), ''), 'non_critical') = $%d", argIndex))
		args = append(args, assetType)
		argIndex++
	}
	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("lower(concat_ws(' ', COALESCE(i.name, s.category), COALESCE(si.name, s.name), s.item_code, COALESCE(s.asset_tag, ''), COALESCE(s.serial_number, ''), COALESCE(s.company_name, ''), COALESCE(sp.name, ''), COALESCE(location.full_name, ''), COALESCE(assignee.full_name, ''))) LIKE $%d", argIndex))
		args = append(args, "%"+search+"%")
		argIndex++
	}
	whereSQL := strings.Join(whereClauses, " AND ")
	countArgs := append([]any{}, args...)
	var total int
	if err := server.db.QueryRow(`
		SELECT COUNT(*)
		FROM stock_items s
		LEFT JOIN sub_items si ON si.id = s.sub_item_id
		LEFT JOIN items i ON i.id = si.item_id
		LEFT JOIN suppliers sp ON sp.id = COALESCE(s.supplier_id, si.supplier_id)
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN locations location ON location.id = COALESCE(s.location_id, s.branch_id)
		LEFT JOIN users assignee ON assignee.id = s.assigned_user_id
		WHERE `+whereSQL, countArgs...).Scan(&total); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	queryArgs := append([]any{}, args...)
	query := `
		SELECT s.id,
		       COALESCE(si.item_id::text, ''),
		       COALESCE(i.name, s.category),
		       COALESCE(s.sub_item_id::text, ''),
		       COALESCE(si.name, s.name),
		       s.item_code,
		       COALESCE(s.asset_tag, ''),
		       COALESCE(s.serial_number, ''),
		       COALESCE(s.company_name, si.company_name, ''),
		       COALESCE(COALESCE(s.supplier_id, si.supplier_id)::text, ''),
		       COALESCE(sp.name, ''),
		       COALESCE(s.operating_system, si.operating_system, ''),
		       COALESCE(NULLIF(s.asset_type, ''), NULLIF(si.asset_type, ''), 'non_critical'),
		       COALESCE(s.assigned_user_id::text, ''),
		       COALESCE(assignee.full_name, ''),
		       COALESCE(assignee.email, ''),
		       COALESCE(s.location_id::text, s.branch_id::text, ''),
		       COALESCE(location.full_name, branch.full_name, ''),
		       COALESCE(s.branch_id::text, ''),
		       COALESCE(branch.full_name, ''),
		       COALESCE(s.cost::text, ''),
		       COALESCE(s.purchase_date::text, ''),
		       COALESCE(s.warranty_expires_at::text, ''),
		       COALESCE(s.specs, ''),
		       COALESCE(s.remarks, ''),
		       s.status,
		       s.created_at
		FROM stock_items s
		LEFT JOIN sub_items si ON si.id = s.sub_item_id
		LEFT JOIN items i ON i.id = si.item_id
		LEFT JOIN suppliers sp ON sp.id = COALESCE(s.supplier_id, si.supplier_id)
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN locations location ON location.id = COALESCE(s.location_id, s.branch_id)
		LEFT JOIN users assignee ON assignee.id = s.assigned_user_id
		WHERE ` + whereSQL + `
		ORDER BY s.created_at DESC`
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
	subItemIDs := make([]string, 0)
	seenSubItemIDs := map[string]struct{}{}
	type rowPayload struct {
		entry gin.H
		subItemID string
		branchID string
		branchName string
	}
	payloads := make([]rowPayload, 0)
	for rows.Next() {
		var id, itemID, itemName, resolvedSubItemID, subItemName, itemCode, assetTag, serialNumber, companyName, supplierID, supplierName, operatingSystem, resolvedAssetType, assignedUserID, assignedUserName, assignedUserEmail, locationID, locationName, resolvedBranchID, resolvedBranchName, cost, purchaseDate, warranty, specs, remarks, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &itemID, &itemName, &resolvedSubItemID, &subItemName, &itemCode, &assetTag, &serialNumber, &companyName, &supplierID, &supplierName, &operatingSystem, &resolvedAssetType, &assignedUserID, &assignedUserName, &assignedUserEmail, &locationID, &locationName, &resolvedBranchID, &resolvedBranchName, &cost, &purchaseDate, &warranty, &specs, &remarks, &status, &createdAt); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		entry := gin.H{
			"id": id,
			"mainItemId": emptyToNil(itemID),
			"mainItem": itemName,
			"subItemId": emptyToNil(resolvedSubItemID),
			"subItem": subItemName,
			"itemCode": itemCode,
			"assetTag": emptyToNil(assetTag),
			"serialNumber": emptyToNil(serialNumber),
			"companyName": emptyToNil(companyName),
			"supplierId": emptyToNil(supplierID),
			"supplierName": emptyToNil(supplierName),
			"operatingSystem": emptyToNil(operatingSystem),
			"assetType": normalizeInventoryAssetType(resolvedAssetType),
			"assignedUserId": emptyToNil(assignedUserID),
			"assignedUserName": emptyToNil(assignedUserName),
			"assignedUserEmail": emptyToNil(assignedUserEmail),
			"locationId": emptyToNil(locationID),
			"locationName": emptyToNil(locationName),
			"branchId": emptyToNil(resolvedBranchID),
			"branchName": emptyToNil(resolvedBranchName),
			"cost": emptyToNil(cost),
			"purchaseDate": emptyToNil(purchaseDate),
			"warrantyExpiresAt": emptyToNil(warranty),
			"specs": emptyToNil(specs),
			"remarks": emptyToNil(remarks),
			"status": status,
			"createdAt": createdAt,
		}
		payloads = append(payloads, rowPayload{entry: entry, subItemID: resolvedSubItemID, branchID: resolvedBranchID, branchName: resolvedBranchName})
		if resolvedSubItemID != "" {
			if _, ok := seenSubItemIDs[resolvedSubItemID]; !ok {
				seenSubItemIDs[resolvedSubItemID] = struct{}{}
				subItemIDs = append(subItemIDs, resolvedSubItemID)
			}
		}
	}
	stockBySubItem, totals, err := inventoryStockQueryMap(server, subItemIDs)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	for _, payload := range payloads {
		stocks := stockBySubItem[payload.subItemID]
		totalStock := totals[payload.subItemID]
		if payload.subItemID == "" {
			stocks = []gin.H{}
			if payload.branchID != "" {
				stocks = append(stocks, gin.H{"branchId": payload.branchID, "branchName": payload.branchName, "quantity": 1})
			}
			totalStock = len(stocks)
		}
		payload.entry["stockByBranch"] = stocks
		payload.entry["stockTotal"] = totalStock
		items = append(items, payload.entry)
	}

	var mainItemCount, subItemCount, supplierCount, branchCount int
	_ = server.db.QueryRow(`SELECT COUNT(*) FROM items`).Scan(&mainItemCount)
	_ = server.db.QueryRow(`SELECT COUNT(*) FROM sub_items`).Scan(&subItemCount)
	_ = server.db.QueryRow(`SELECT COUNT(*) FROM suppliers`).Scan(&supplierCount)
	_ = server.db.QueryRow(`SELECT COUNT(*) FROM locations`).Scan(&branchCount)

	httpx.JSON(c, http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page": page,
		"pageSize": pageSize,
		"summary": gin.H{
			"assets": total,
			"mainItems": mainItemCount,
			"subItems": subItemCount,
			"branches": branchCount,
			"suppliers": supplierCount,
		},
	})
}

func setInventoryStockLevels(tx *sql.Tx, subItemID string, stocks []inventoryBranchStockInput) error {
	if strings.TrimSpace(subItemID) == "" {
		return nil
	}
	if _, err := tx.Exec(`DELETE FROM inventory_stock WHERE sub_item_id = $1::uuid`, subItemID); err != nil {
		return err
	}
	for _, stock := range stocks {
		if strings.TrimSpace(stock.BranchID) == "" || stock.Quantity < 0 {
			continue
		}
		if stock.Quantity == 0 {
			continue
		}
		if _, err := tx.Exec(`
			INSERT INTO inventory_stock (sub_item_id, branch_id, quantity)
			VALUES ($1::uuid, $2::uuid, $3)
		`, subItemID, stock.BranchID, stock.Quantity); err != nil {
			return err
		}
	}
	return nil
}

func adjustInventoryStockLevel(tx *sql.Tx, subItemID string, branchID string, delta int) error {
	if strings.TrimSpace(subItemID) == "" || strings.TrimSpace(branchID) == "" || delta == 0 {
		return nil
	}
	var quantity int
	err := tx.QueryRow(`SELECT quantity FROM inventory_stock WHERE sub_item_id = $1::uuid AND branch_id = $2::uuid`, subItemID, branchID).Scan(&quantity)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if errors.Is(err, sql.ErrNoRows) {
		quantity = 0
	}
	next := quantity + delta
	if next < 0 {
		return fmt.Errorf("insufficient stock in selected branch")
	}
	if next == 0 {
		_, err = tx.Exec(`DELETE FROM inventory_stock WHERE sub_item_id = $1::uuid AND branch_id = $2::uuid`, subItemID, branchID)
		return err
	}
	_, err = tx.Exec(`
		INSERT INTO inventory_stock (sub_item_id, branch_id, quantity)
		VALUES ($1::uuid, $2::uuid, $3)
		ON CONFLICT (sub_item_id, branch_id) DO UPDATE
		SET quantity = EXCLUDED.quantity,
		    updated_at = NOW()
	`, subItemID, branchID, next)
	return err
}

func (server *apiServer) createInventoryModuleAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		SubItemID          string                    `json:"subItemId"`
		AssetTag           string                    `json:"assetTag"`
		SerialNumber       string                    `json:"serialNumber"`
		CompanyName        string                    `json:"companyName"`
		SupplierID         string                    `json:"supplierId"`
		OperatingSystem    string                    `json:"operatingSystem"`
		AssetType          string                    `json:"assetType"`
		AssignedUserID     string                    `json:"assignedUserId"`
		LocationID         string                    `json:"locationId"`
		BranchID           string                    `json:"branchId"`
		BranchStocks       []inventoryBranchStockInput `json:"branchStocks"`
		Cost               string                    `json:"cost"`
		PurchaseDate       string                    `json:"purchaseDate"`
		WarrantyExpiresAt  string                    `json:"warrantyExpiresAt"`
		Specs              string                    `json:"specs"`
		Remarks            string                    `json:"remarks"`
		Status             string                    `json:"status"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid inventory asset payload")
		return
	}
	if strings.TrimSpace(input.SubItemID) == "" {
		httpx.Error(c, http.StatusBadRequest, "subItemId is required")
		return
	}
	tx, err := server.db.Begin()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	var id, itemCode string
	status := strings.TrimSpace(input.Status)
	if status == "" {
		if strings.TrimSpace(input.AssignedUserID) != "" {
			status = "allocated"
		} else {
			status = "inventory"
		}
	}
	branchID := strings.TrimSpace(input.BranchID)
	if branchID == "" && len(input.BranchStocks) > 0 {
		branchID = strings.TrimSpace(input.BranchStocks[0].BranchID)
	}
	locationID := strings.TrimSpace(input.LocationID)
	if locationID == "" {
		locationID = branchID
	}
	err = tx.QueryRow(`
		INSERT INTO stock_items (
			sub_item_id, category, name, item_code, asset_tag, serial_number, specs, branch_id, assigned_user_id, warranty_expires_at, cost, company_name,
			supplier_id, operating_system, asset_type, location_id, purchase_date, remarks, status
		)
		SELECT $1::uuid,
		       COALESCE(i.name, ''),
		       COALESCE(si.name, ''),
		       si.item_code,
		       $2,
		       $3,
		       NULLIF($4, ''),
		       NULLIF($5, '')::uuid,
		       NULLIF($6, '')::uuid,
		       NULLIF($7, '')::date,
		       NULLIF($8, '')::numeric(12,2),
		       NULLIF($9, ''),
		       NULLIF($10, '')::uuid,
		       NULLIF($11, ''),
		       $12,
		       NULLIF($13, '')::uuid,
		       NULLIF($14, '')::date,
		       NULLIF($15, ''),
		       $16
		FROM sub_items si
		JOIN items i ON i.id = si.item_id
		WHERE si.id = $1::uuid
		RETURNING id, item_code
	`, input.SubItemID, strings.TrimSpace(input.AssetTag), strings.TrimSpace(input.SerialNumber), strings.TrimSpace(input.Specs), branchID, strings.TrimSpace(input.AssignedUserID), strings.TrimSpace(input.WarrantyExpiresAt), strings.TrimSpace(input.Cost), strings.TrimSpace(input.CompanyName), strings.TrimSpace(input.SupplierID), strings.TrimSpace(input.OperatingSystem), normalizeInventoryAssetType(input.AssetType), locationID, strings.TrimSpace(input.PurchaseDate), strings.TrimSpace(input.Remarks), status).Scan(&id, &itemCode)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if len(input.BranchStocks) > 0 {
		if err := setInventoryStockLevels(tx, input.SubItemID, input.BranchStocks); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	} else if branchID != "" {
		if err := adjustInventoryStockLevel(tx, input.SubItemID, branchID, 1); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := tx.Commit(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_item_created", TargetType: "inventory_item", TargetID: id, Detail: input})
	httpx.Created(c, gin.H{"id": id, "itemCode": itemCode})
}

func (server *apiServer) updateInventoryModuleAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		SubItemID          string                    `json:"subItemId"`
		AssetTag           string                    `json:"assetTag"`
		SerialNumber       string                    `json:"serialNumber"`
		CompanyName        string                    `json:"companyName"`
		SupplierID         string                    `json:"supplierId"`
		OperatingSystem    string                    `json:"operatingSystem"`
		AssetType          string                    `json:"assetType"`
		AssignedUserID     string                    `json:"assignedUserId"`
		LocationID         string                    `json:"locationId"`
		BranchID           string                    `json:"branchId"`
		BranchStocks       []inventoryBranchStockInput `json:"branchStocks"`
		Cost               string                    `json:"cost"`
		PurchaseDate       string                    `json:"purchaseDate"`
		WarrantyExpiresAt  string                    `json:"warrantyExpiresAt"`
		Specs              string                    `json:"specs"`
		Remarks            string                    `json:"remarks"`
		Status             string                    `json:"status"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid inventory asset payload")
		return
	}
	tx, err := server.db.Begin()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	var previousSubItemID, previousBranchID string
	if err := tx.QueryRow(`SELECT COALESCE(sub_item_id::text, ''), COALESCE(branch_id::text, '') FROM stock_items WHERE id = $1::uuid`, c.Param("id")).Scan(&previousSubItemID, &previousBranchID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "inventory item not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	branchID := strings.TrimSpace(input.BranchID)
	if branchID == "" && len(input.BranchStocks) > 0 {
		branchID = strings.TrimSpace(input.BranchStocks[0].BranchID)
	}
	locationID := strings.TrimSpace(input.LocationID)
	if locationID == "" {
		locationID = branchID
	}
	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "inventory"
	}
	result, err := tx.Exec(`
		UPDATE stock_items
		SET sub_item_id = NULLIF($2, '')::uuid,
		    category = COALESCE((SELECT i.name FROM sub_items si JOIN items i ON i.id = si.item_id WHERE si.id = NULLIF($2, '')::uuid), category),
		    name = COALESCE((SELECT si.name FROM sub_items si WHERE si.id = NULLIF($2, '')::uuid), name),
		    item_code = COALESCE((SELECT si.item_code FROM sub_items si WHERE si.id = NULLIF($2, '')::uuid), item_code),
		    asset_tag = $3,
		    serial_number = $4,
		    specs = NULLIF($5, ''),
		    branch_id = NULLIF($6, '')::uuid,
		    assigned_user_id = NULLIF($7, '')::uuid,
		    warranty_expires_at = NULLIF($8, '')::date,
		    cost = NULLIF($9, '')::numeric(12,2),
		    company_name = NULLIF($10, ''),
		    supplier_id = NULLIF($11, '')::uuid,
		    operating_system = NULLIF($12, ''),
		    asset_type = $13,
		    location_id = NULLIF($14, '')::uuid,
		    purchase_date = NULLIF($15, '')::date,
		    remarks = NULLIF($16, ''),
		    status = $17,
		    updated_at = NOW()
		WHERE id = $1::uuid
	`, c.Param("id"), strings.TrimSpace(input.SubItemID), strings.TrimSpace(input.AssetTag), strings.TrimSpace(input.SerialNumber), strings.TrimSpace(input.Specs), branchID, strings.TrimSpace(input.AssignedUserID), strings.TrimSpace(input.WarrantyExpiresAt), strings.TrimSpace(input.Cost), strings.TrimSpace(input.CompanyName), strings.TrimSpace(input.SupplierID), strings.TrimSpace(input.OperatingSystem), normalizeInventoryAssetType(input.AssetType), locationID, strings.TrimSpace(input.PurchaseDate), strings.TrimSpace(input.Remarks), status)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		httpx.Error(c, http.StatusNotFound, "inventory item not found")
		return
	}
	if len(input.BranchStocks) > 0 {
		if err := setInventoryStockLevels(tx, strings.TrimSpace(input.SubItemID), input.BranchStocks); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	} else if previousSubItemID != strings.TrimSpace(input.SubItemID) || previousBranchID != branchID {
		if err := adjustInventoryStockLevel(tx, previousSubItemID, previousBranchID, -1); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		if err := adjustInventoryStockLevel(tx, strings.TrimSpace(input.SubItemID), branchID, 1); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := tx.Commit(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_item_updated", TargetType: "inventory_item", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"status": "updated"})
}

func (server *apiServer) deleteInventoryModuleAsset(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var subItemID, branchID, status, assignedUserID string
	if err := server.db.QueryRow(`SELECT COALESCE(sub_item_id::text, ''), COALESCE(branch_id::text, ''), status, COALESCE(assigned_user_id::text, '') FROM stock_items WHERE id = $1::uuid`, c.Param("id")).Scan(&subItemID, &branchID, &status, &assignedUserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.Error(c, http.StatusNotFound, "inventory item not found")
			return
		}
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if assignedUserID != "" || status == "allocated" {
		httpx.Error(c, http.StatusBadRequest, "assigned inventory item cannot be deleted")
		return
	}
	tx, err := server.db.Begin()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM stock_items WHERE id = $1::uuid`, c.Param("id")); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := adjustInventoryStockLevel(tx, subItemID, branchID, -1); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_item_deleted", TargetType: "inventory_item", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"status": "deleted"})
}

func (server *apiServer) inventoryModuleItems(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}
	items, err := server.simpleLookup(`SELECT id, name FROM items ORDER BY name`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.JSON(c, http.StatusOK, items)
}

func (server *apiServer) createInventoryModuleItem(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct { Name string `json:"name"` }
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "name is required")
		return
	}
	exists, err := server.inventoryMainItemExists(input.Name, "")
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if exists {
		httpx.Error(c, http.StatusBadRequest, "main item already exists")
		return
	}
	var id string
	if err := server.db.QueryRow(`INSERT INTO items (name) VALUES ($1) RETURNING id`, strings.TrimSpace(input.Name)).Scan(&id); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_main_item_created", TargetType: "inventory_main_item", TargetID: id, Detail: input})
	httpx.Created(c, gin.H{"id": id, "name": strings.TrimSpace(input.Name)})
}

func (server *apiServer) updateInventoryModuleItem(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct { Name string `json:"name"` }
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "name is required")
		return
	}
	exists, err := server.inventoryMainItemExists(input.Name, c.Param("id"))
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if exists {
		httpx.Error(c, http.StatusBadRequest, "main item already exists")
		return
	}
	if _, err := server.db.Exec(`UPDATE items SET name = $2, updated_at = NOW() WHERE id = $1::uuid`, c.Param("id"), strings.TrimSpace(input.Name)); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_main_item_updated", TargetType: "inventory_main_item", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deleteInventoryModuleItem(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var count int
	if err := server.db.QueryRow(`SELECT COUNT(*) FROM sub_items WHERE item_id = $1::uuid`, c.Param("id")).Scan(&count); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if count > 0 {
		httpx.Error(c, http.StatusBadRequest, "main item still has sub items")
		return
	}
	if _, err := server.db.Exec(`DELETE FROM items WHERE id = $1::uuid`, c.Param("id")); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_main_item_deleted", TargetType: "inventory_main_item", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) inventoryModuleSubItems(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}
	itemID := strings.TrimSpace(c.Query("itemId"))
	if itemID == "" {
		itemID = strings.TrimSpace(c.Query("item_id"))
	}
	args := []any{}
	where := ""
	if itemID != "" {
		where = "WHERE si.item_id = $1::uuid"
		args = append(args, itemID)
	}
	rows, err := server.db.Query(`
		SELECT si.id, si.item_id::text, i.name, si.name, si.item_code, COALESCE(si.company_name, ''), COALESCE(si.supplier_id::text, ''), COALESCE(sp.name, ''), COALESCE(si.operating_system, ''), COALESCE(si.asset_type, 'non_critical'), COALESCE(si.specs_remarks, '')
		FROM sub_items si
		JOIN items i ON i.id = si.item_id
		LEFT JOIN suppliers sp ON sp.id = si.supplier_id
		`+where+`
		ORDER BY i.name, si.name
	`, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	result := make([]gin.H, 0)
	for rows.Next() {
		var id, resolvedItemID, itemName, name, itemCode, companyName, supplierID, supplierName, operatingSystem, assetType, remarks string
		if err := rows.Scan(&id, &resolvedItemID, &itemName, &name, &itemCode, &companyName, &supplierID, &supplierName, &operatingSystem, &assetType, &remarks); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		result = append(result, gin.H{"id": id, "itemId": resolvedItemID, "itemName": itemName, "name": name, "itemCode": itemCode, "companyName": emptyToNil(companyName), "supplierId": emptyToNil(supplierID), "supplierName": emptyToNil(supplierName), "operatingSystem": emptyToNil(operatingSystem), "assetType": normalizeInventoryAssetType(assetType), "remarks": emptyToNil(remarks)})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) createInventoryModuleSubItem(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		ItemID string `json:"itemId"`
		Name string `json:"name"`
		ItemCode string `json:"itemCode"`
		CompanyName string `json:"companyName"`
		SupplierID string `json:"supplierId"`
		OperatingSystem string `json:"operatingSystem"`
		AssetType string `json:"assetType"`
		Remarks string `json:"remarks"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.ItemID) == "" || strings.TrimSpace(input.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "itemId and name are required")
		return
	}
	exists, err := server.inventorySubItemExists(input.ItemID, input.Name, "")
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if exists {
		httpx.Error(c, http.StatusBadRequest, "sub item already exists under the selected main item")
		return
	}
	resolvedItemCode := strings.TrimSpace(strings.ToUpper(input.ItemCode))
	if resolvedItemCode == "" {
		resolvedItemCode, err = server.generateInventorySubItemCode(input.ItemID, input.Name)
		if err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	} else {
		codeExists, err := server.inventoryItemCodeExists(resolvedItemCode, "")
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if codeExists {
			httpx.Error(c, http.StatusBadRequest, "item code already exists")
			return
		}
	}
	var id string
	if err := server.db.QueryRow(`
		INSERT INTO sub_items (item_id, name, item_code, company_name, supplier_id, operating_system, asset_type, specs_remarks)
		VALUES ($1::uuid, $2, $3, NULLIF($4, ''), NULLIF($5, '')::uuid, NULLIF($6, ''), $7, NULLIF($8, ''))
		RETURNING id
	`, input.ItemID, strings.TrimSpace(input.Name), resolvedItemCode, strings.TrimSpace(input.CompanyName), strings.TrimSpace(input.SupplierID), strings.TrimSpace(input.OperatingSystem), normalizeInventoryAssetType(input.AssetType), strings.TrimSpace(input.Remarks)).Scan(&id); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_sub_item_created", TargetType: "inventory_sub_item", TargetID: id, Detail: input})
	httpx.Created(c, gin.H{"id": id, "itemCode": resolvedItemCode, "name": strings.TrimSpace(input.Name)})
}

func (server *apiServer) updateInventoryModuleSubItem(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		ItemID string `json:"itemId"`
		Name string `json:"name"`
		ItemCode string `json:"itemCode"`
		CompanyName string `json:"companyName"`
		SupplierID string `json:"supplierId"`
		OperatingSystem string `json:"operatingSystem"`
		AssetType string `json:"assetType"`
		Remarks string `json:"remarks"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid sub item payload")
		return
	}
	if strings.TrimSpace(input.ItemID) != "" && strings.TrimSpace(input.Name) != "" {
		exists, err := server.inventorySubItemExists(input.ItemID, input.Name, c.Param("id"))
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if exists {
			httpx.Error(c, http.StatusBadRequest, "sub item already exists under the selected main item")
			return
		}
	}
	if strings.TrimSpace(input.ItemCode) != "" {
		codeExists, err := server.inventoryItemCodeExists(input.ItemCode, c.Param("id"))
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		if codeExists {
			httpx.Error(c, http.StatusBadRequest, "item code already exists")
			return
		}
	}
	if _, err := server.db.Exec(`
		UPDATE sub_items
		SET item_id = COALESCE(NULLIF($2, '')::uuid, item_id),
		    name = COALESCE(NULLIF($3, ''), name),
		    item_code = COALESCE(NULLIF($4, ''), item_code),
		    company_name = NULLIF($5, ''),
		    supplier_id = NULLIF($6, '')::uuid,
		    operating_system = NULLIF($7, ''),
		    asset_type = $8,
		    specs_remarks = NULLIF($9, ''),
		    updated_at = NOW()
		WHERE id = $1::uuid
	`, c.Param("id"), strings.TrimSpace(input.ItemID), strings.TrimSpace(input.Name), strings.TrimSpace(strings.ToUpper(input.ItemCode)), strings.TrimSpace(input.CompanyName), strings.TrimSpace(input.SupplierID), strings.TrimSpace(input.OperatingSystem), normalizeInventoryAssetType(input.AssetType), strings.TrimSpace(input.Remarks)); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_sub_item_updated", TargetType: "inventory_sub_item", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deleteInventoryModuleSubItem(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var assetCount, stockCount int
	if err := server.db.QueryRow(`SELECT COUNT(*) FROM stock_items WHERE sub_item_id = $1::uuid`, c.Param("id")).Scan(&assetCount); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := server.db.QueryRow(`SELECT COUNT(*) FROM inventory_stock WHERE sub_item_id = $1::uuid AND quantity > 0`, c.Param("id")).Scan(&stockCount); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if assetCount > 0 || stockCount > 0 {
		httpx.Error(c, http.StatusBadRequest, "sub item is still in use")
		return
	}
	if _, err := server.db.Exec(`DELETE FROM sub_items WHERE id = $1::uuid`, c.Param("id")); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_sub_item_deleted", TargetType: "inventory_sub_item", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) inventoryModuleSuppliers(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team", "auditor") {
		return
	}
	rows, err := server.db.Query(`SELECT id, name, COALESCE(contact_info, '') FROM suppliers ORDER BY name`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	result := make([]gin.H, 0)
	for rows.Next() {
		var id, name, contactInfo string
		if err := rows.Scan(&id, &name, &contactInfo); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		result = append(result, gin.H{"id": id, "name": name, "contactInfo": emptyToNil(contactInfo)})
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (server *apiServer) createInventoryModuleSupplier(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct { Name string `json:"name"`; ContactInfo string `json:"contactInfo"` }
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "supplier name is required")
		return
	}
	var id string
	if err := server.db.QueryRow(`INSERT INTO suppliers (name, contact_info) VALUES ($1, NULLIF($2, '')) RETURNING id`, strings.TrimSpace(input.Name), strings.TrimSpace(input.ContactInfo)).Scan(&id); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_supplier_created", TargetType: "inventory_supplier", TargetID: id, Detail: input})
	httpx.Created(c, gin.H{"id": id})
}

func (server *apiServer) updateInventoryModuleSupplier(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var input struct { Name string `json:"name"`; ContactInfo string `json:"contactInfo"` }
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "supplier name is required")
		return
	}
	if _, err := server.db.Exec(`UPDATE suppliers SET name = $2, contact_info = NULLIF($3, ''), updated_at = NOW() WHERE id = $1::uuid`, c.Param("id"), strings.TrimSpace(input.Name), strings.TrimSpace(input.ContactInfo)); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_supplier_updated", TargetType: "inventory_supplier", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deleteInventoryModuleSupplier(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}
	var count int
	if err := server.db.QueryRow(`SELECT COUNT(*) FROM sub_items WHERE supplier_id = $1::uuid`, c.Param("id")).Scan(&count); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if count > 0 {
		httpx.Error(c, http.StatusBadRequest, "supplier is still referenced by inventory")
		return
	}
	if _, err := server.db.Exec(`DELETE FROM suppliers WHERE id = $1::uuid`, c.Param("id")); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_supplier_deleted", TargetType: "inventory_supplier", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) inventoryModuleBranches(c *gin.Context) {
	server.listLocations(c)
}

func (server *apiServer) createInventoryModuleBranch(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	var input struct {
		EntityID string `json:"entityId"`
		Name string `json:"name"`
		Location string `json:"location"`
		LocationCode string `json:"locationCode"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.Name) == "" {
		httpx.Error(c, http.StatusBadRequest, "branch name is required")
		return
	}
	entityID := strings.TrimSpace(input.EntityID)
	if claims.Role != "super_admin" || entityID == "" {
		entityID = claims.EntityID
	}
	var id string
	if err := server.db.QueryRow(`
		INSERT INTO locations (entity_id, location_code, full_name, city, state, is_active)
		VALUES ($1::uuid, $2, $3, $4, '', TRUE)
		RETURNING id
	`, entityID, strings.ToUpper(strings.TrimSpace(input.LocationCode)), strings.TrimSpace(input.Name), strings.TrimSpace(input.Location)).Scan(&id); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "location_created", TargetType: "location", TargetID: id, Detail: input})
	httpx.Created(c, gin.H{"id": id})
}

func (server *apiServer) updateInventoryModuleBranch(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	var input struct {
		Name string `json:"name"`
		Location string `json:"location"`
		LocationCode string `json:"locationCode"`
		IsActive *bool `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid branch payload")
		return
	}
	if claims.Role != "super_admin" {
		if ok, err := server.locationScope(c, c.Param("id")); err != nil || !ok {
			httpx.Error(c, http.StatusForbidden, "forbidden")
			return
		}
	}
	if _, err := server.db.Exec(`
		UPDATE locations
		SET location_code = COALESCE(NULLIF($2, ''), location_code),
		    full_name = COALESCE(NULLIF($3, ''), full_name),
		    city = COALESCE(NULLIF($4, ''), city),
		    is_active = COALESCE($5, is_active),
		    updated_at = NOW()
		WHERE id = $1::uuid
	`, c.Param("id"), strings.ToUpper(strings.TrimSpace(input.LocationCode)), strings.TrimSpace(input.Name), strings.TrimSpace(input.Location), input.IsActive); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "location_updated", TargetType: "location", TargetID: c.Param("id"), Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) deleteInventoryModuleBranch(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	claims := middleware.CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if claims.Role != "super_admin" {
		if ok, err := server.locationScope(c, c.Param("id")); err != nil || !ok {
			httpx.Error(c, http.StatusForbidden, "forbidden")
			return
		}
	}
	var stockRefCount, assetRefCount int
	_ = server.db.QueryRow(`SELECT COUNT(*) FROM inventory_stock WHERE branch_id = $1::uuid`, c.Param("id")).Scan(&stockRefCount)
	_ = server.db.QueryRow(`SELECT COUNT(*) FROM stock_items WHERE branch_id = $1::uuid OR location_id = $1::uuid`, c.Param("id")).Scan(&assetRefCount)
	if stockRefCount > 0 || assetRefCount > 0 {
		httpx.Error(c, http.StatusBadRequest, "branch is still referenced by inventory records")
		return
	}
	if _, err := server.db.Exec(`DELETE FROM locations WHERE id = $1::uuid`, c.Param("id")); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "location_deleted", TargetType: "location", TargetID: c.Param("id")})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) inventoryModuleStockOperation(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	var input struct {
		Operation string `json:"operation"`
		SubItemID string `json:"subItemId"`
		BranchID string `json:"branchId"`
		FromBranchID string `json:"fromBranchId"`
		ToBranchID string `json:"toBranchId"`
		Quantity int `json:"quantity"`
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || strings.TrimSpace(input.SubItemID) == "" || input.Quantity <= 0 {
		httpx.Error(c, http.StatusBadRequest, "operation, subItemId, and positive quantity are required")
		return
	}
	operation := strings.ToLower(strings.TrimSpace(input.Operation))
	tx, err := server.db.Begin()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()
	switch operation {
	case "add":
		if strings.TrimSpace(input.BranchID) == "" {
			httpx.Error(c, http.StatusBadRequest, "branchId is required")
			return
		}
		if err := adjustInventoryStockLevel(tx, input.SubItemID, input.BranchID, input.Quantity); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	case "reduce":
		if strings.TrimSpace(input.BranchID) == "" {
			httpx.Error(c, http.StatusBadRequest, "branchId is required")
			return
		}
		if err := adjustInventoryStockLevel(tx, input.SubItemID, input.BranchID, -input.Quantity); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	case "transfer":
		if strings.TrimSpace(input.FromBranchID) == "" || strings.TrimSpace(input.ToBranchID) == "" {
			httpx.Error(c, http.StatusBadRequest, "fromBranchId and toBranchId are required")
			return
		}
		if input.FromBranchID == input.ToBranchID {
			httpx.Error(c, http.StatusBadRequest, "source and destination branches must differ")
			return
		}
		if err := adjustInventoryStockLevel(tx, input.SubItemID, input.FromBranchID, -input.Quantity); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		if err := adjustInventoryStockLevel(tx, input.SubItemID, input.ToBranchID, input.Quantity); err != nil {
			httpx.Error(c, http.StatusBadRequest, err.Error())
			return
		}
	default:
		httpx.Error(c, http.StatusBadRequest, "unsupported stock operation")
		return
	}
	claims := middleware.CurrentClaims(c)
	actorID := ""
	if claims != nil {
		actorID = claims.UserID
	}
	if _, err := tx.Exec(`
		INSERT INTO inventory_stock_movements (sub_item_id, operation, from_branch_id, to_branch_id, quantity, note, actor_id)
		VALUES ($1::uuid, $2, NULLIF($3, '')::uuid, NULLIF($4, '')::uuid, $5, NULLIF($6, ''), NULLIF($7, '')::uuid)
	`, input.SubItemID, operation, strings.TrimSpace(input.FromBranchID), coalesceString(strings.TrimSpace(input.ToBranchID), strings.TrimSpace(input.BranchID)), input.Quantity, strings.TrimSpace(input.Note), actorID); err != nil {
		httpx.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	middleware.TagAudit(c, middleware.AuditMeta{Action: "inventory_stock_changed", TargetType: "inventory_stock", TargetID: input.SubItemID, Detail: input})
	httpx.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (server *apiServer) exportInventoryModuleTemplate(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	writer := csv.NewWriter(c.Writer)
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=inventory-module-template.csv")
	_ = writer.Write([]string{"Main Item", "Sub Item", "Item Code", "Asset ID", "Serial Number", "Branch Name", "Quantity", "Company Name", "Supplier", "Location", "Asset Type", "Employee Name", "Cost", "Purchase Date", "Warranty", "Specs"})
	_ = writer.Write([]string{"Laptop", "ThinkPad X1", "LTP-X1", "AST-1001", "SN1001", "ZBL Head Office, Bangalore", "1", "Lenovo", "Lenovo India", "ZBL Head Office, Bangalore", "Critical", "", "125000", "2026-04-29", "2029-04-29", "32GB RAM / 1TB SSD"})
	writer.Flush()
}

func (server *apiServer) exportInventoryModuleCSV(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}
	rows, err := server.db.Query(`
		SELECT COALESCE(i.name, s.category), COALESCE(si.name, s.name), s.item_code, COALESCE(s.asset_tag, ''), COALESCE(s.serial_number, ''),
		       COALESCE(branch.full_name, ''),
		       COALESCE(ist.quantity, 1),
		       COALESCE(s.company_name, si.company_name, ''),
		       COALESCE(sp.name, ''),
		       COALESCE(location.full_name, branch.full_name, ''),
		       COALESCE(NULLIF(s.asset_type, ''), NULLIF(si.asset_type, ''), 'non_critical'),
		       COALESCE(u.full_name, ''),
		       COALESCE(s.cost::text, ''),
		       COALESCE(s.purchase_date::text, ''),
		       COALESCE(s.warranty_expires_at::text, ''),
		       COALESCE(s.specs, '')
		FROM stock_items s
		LEFT JOIN sub_items si ON si.id = s.sub_item_id
		LEFT JOIN items i ON i.id = si.item_id
		LEFT JOIN suppliers sp ON sp.id = COALESCE(s.supplier_id, si.supplier_id)
		LEFT JOIN locations branch ON branch.id = s.branch_id
		LEFT JOIN locations location ON location.id = COALESCE(s.location_id, s.branch_id)
		LEFT JOIN users u ON u.id = s.assigned_user_id
		LEFT JOIN inventory_stock ist ON ist.sub_item_id = s.sub_item_id AND ist.branch_id = s.branch_id
		ORDER BY COALESCE(i.name, s.category), COALESCE(si.name, s.name), s.item_code
	`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	writer := csv.NewWriter(c.Writer)
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=inventory-module-export.csv")
	headers := []string{"Main Item", "Sub Item", "Item Code", "Asset ID", "Serial Number", "Branch Name", "Quantity", "Company Name", "Supplier", "Location", "Asset Type", "Employee Name", "Cost", "Purchase Date", "Warranty", "Specs"}
	_ = writer.Write(headers)
	for rows.Next() {
		record := make([]string, len(headers))
		if err := rows.Scan(&record[0], &record[1], &record[2], &record[3], &record[4], &record[5], &record[6], &record[7], &record[8], &record[9], &record[10], &record[11], &record[12], &record[13], &record[14], &record[15]); err != nil {
			httpx.Error(c, http.StatusInternalServerError, err.Error())
			return
		}
		_ = writer.Write(record)
	}
	writer.Flush()
}

func (server *apiServer) importInventoryModuleCSV(c *gin.Context) {
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
	if err != nil || len(records) == 0 {
		httpx.Error(c, http.StatusBadRequest, "invalid csv file")
		return
	}
	headers := map[int]string{}
	for index, value := range records[0] {
		headers[index] = normalizeCSVHeader(value)
	}
	rowErrors := make([]gin.H, 0)
	created := 0
	for rowIndex, record := range records[1:] {
		row := map[string]string{}
		for index, value := range record {
			row[headers[index]] = strings.TrimSpace(value)
		}
		csvRowNumber := rowIndex + 2
		mainItemName := row["main_item"]
		subItemName := row["sub_item"]
		itemCode := strings.ToUpper(row["item_code"])
		assetTag := row["asset_id"]
		serialNumber := row["serial_number"]
		branchName := row["branch_name"]
		quantityValue := row["quantity"]
		if mainItemName == "" || subItemName == "" || itemCode == "" || assetTag == "" || serialNumber == "" || branchName == "" {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "main item, sub item, item code, asset id, serial number, and branch name are required"})
			continue
		}
		quantity, err := strconv.Atoi(quantityValue)
		if err != nil || quantity < 0 {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "quantity must be numeric"})
			continue
		}
		var duplicateCount int
		if err := server.db.QueryRow(`SELECT COUNT(*) FROM stock_items WHERE asset_tag = $1 OR serial_number = $2`, assetTag, serialNumber).Scan(&duplicateCount); err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}
		if duplicateCount > 0 {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "asset id or serial number already exists"})
			continue
		}
		tx, err := server.db.Begin()
		if err != nil {
			rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
			continue
		}
		func() {
			defer tx.Rollback()
			var itemID string
			if err := tx.QueryRow(`INSERT INTO items (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id`, mainItemName).Scan(&itemID); err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				return
			}
			var supplierID string
			supplierName := row["supplier"]
			if supplierName != "" {
				if err := tx.QueryRow(`INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET updated_at = NOW() RETURNING id`, supplierName).Scan(&supplierID); err != nil {
					rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
					return
				}
			}
			var subItemID string
			if err := tx.QueryRow(`
				INSERT INTO sub_items (item_id, name, item_code, company_name, supplier_id, operating_system, asset_type, specs_remarks)
				VALUES ($1::uuid, $2, $3, NULLIF($4, ''), NULLIF($5, '')::uuid, NULLIF($6, ''), $7, NULLIF($8, ''))
				ON CONFLICT (item_code) DO UPDATE
				SET item_id = EXCLUDED.item_id,
				    name = EXCLUDED.name,
				    company_name = EXCLUDED.company_name,
				    supplier_id = EXCLUDED.supplier_id,
				    operating_system = EXCLUDED.operating_system,
				    asset_type = EXCLUDED.asset_type,
				    specs_remarks = EXCLUDED.specs_remarks,
				    updated_at = NOW()
				RETURNING id
			`, itemID, subItemName, itemCode, row["company_name"], supplierID, row["operating_system"], normalizeInventoryAssetType(row["asset_type"]), row["specs"]).Scan(&subItemID); err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				return
			}
			var branchID string
			if err := tx.QueryRow(`SELECT id FROM locations WHERE lower(full_name) = lower($1) LIMIT 1`, branchName).Scan(&branchID); err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": "branch must exist"})
				return
			}
			var employeeID string
			employeeName := row["employee_name"]
			if employeeName != "" {
				_ = tx.QueryRow(`SELECT id FROM users WHERE lower(full_name) = lower($1) LIMIT 1`, employeeName).Scan(&employeeID)
			}
			status := "inventory"
			if employeeID != "" {
				status = "allocated"
			}
			if _, err := tx.Exec(`
				INSERT INTO stock_items (sub_item_id, category, name, item_code, asset_tag, serial_number, branch_id, assigned_user_id, company_name, supplier_id, operating_system, asset_type, location_id, cost, purchase_date, warranty_expires_at, specs, status)
				VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, NULLIF($8, '')::uuid, NULLIF($9, ''), NULLIF($10, '')::uuid, NULLIF($11, ''), $12, $7::uuid, NULLIF($13, '')::numeric(12,2), NULLIF($14, '')::date, NULLIF($15, '')::date, NULLIF($16, ''), $17)
			`, subItemID, mainItemName, subItemName, itemCode, assetTag, serialNumber, branchID, employeeID, row["company_name"], supplierID, row["operating_system"], normalizeInventoryAssetType(row["asset_type"]), row["cost"], row["purchase_date"], row["warranty"], row["specs"], status); err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				return
			}
			if quantity > 0 {
				if err := adjustInventoryStockLevel(tx, subItemID, branchID, quantity); err != nil {
					rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
					return
				}
			}
			if err := tx.Commit(); err != nil {
				rowErrors = append(rowErrors, gin.H{"row": csvRowNumber, "message": err.Error()})
				return
			}
			created++
		}()
	}
	httpx.JSON(c, http.StatusOK, gin.H{"created": created, "errors": rowErrors})
}