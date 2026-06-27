package api

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

// IT Documentation handlers

// GET /api/docs/categories - List all documentation categories (collections)
func (server *apiServer) listDocsCategories(c *gin.Context) {
	rows, err := server.db.QueryContext(c.Request.Context(), `
		SELECT 
			category,
			COUNT(*) as doc_count,
			COUNT(*) FILTER (WHERE is_published = true) as published_count,
			MAX(updated_at) as last_updated
		FROM it_docs
		GROUP BY category
		ORDER BY category
	`)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch categories")
		return
	}
	defer rows.Close()

	type category struct {
		Name            string    `json:"name"`
		DocCount        int       `json:"docCount"`
		PublishedCount  int       `json:"publishedCount"`
		LastUpdated     time.Time `json:"lastUpdated"`
	}

	categories := make([]category, 0)
	for rows.Next() {
		var cat category
		if err := rows.Scan(&cat.Name, &cat.DocCount, &cat.PublishedCount, &cat.LastUpdated); err != nil {
			continue
		}
		categories = append(categories, cat)
	}

	httpx.JSON(c, http.StatusOK, gin.H{"categories": categories})
}

// POST /api/docs/categories - Create a new category (just validates and returns it)
func (server *apiServer) createDocsCategory(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	var input struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid category data")
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		httpx.Error(c, http.StatusBadRequest, "category name is required")
		return
	}

	// Categories are implicit - just return the validated name
	httpx.JSON(c, http.StatusCreated, gin.H{
		"name":        input.Name,
		"description": input.Description,
		"created":     true,
	})
}

// GET /api/docs/pages - List documentation pages with filters
func (server *apiServer) listDocsPages(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	
	category := strings.TrimSpace(c.Query("category"))
	tag := strings.TrimSpace(c.Query("tag"))
	search := strings.TrimSpace(c.Query("search"))
	assetID := strings.TrimSpace(c.Query("assetId"))
	publishedOnly := c.Query("published") == "true"

	query := `
		SELECT 
			d.id, d.title, d.content, d.category, d.author_id,
			d.tags, d.is_published, d.view_count, d.helpful_count,
			d.created_at, d.updated_at,
			u.name as author_name, u.email as author_email
		FROM it_docs d
		LEFT JOIN users u ON u.id = d.author_id
		WHERE 1=1
	`
	args := make([]interface{}, 0)
	argCount := 0

	// If not admin/it_team, only show published docs or own docs
	if claims.Role != "super_admin" && claims.Role != "it_team" {
		argCount++
		query += ` AND (d.is_published = true OR d.author_id = $` + string(rune('0'+argCount)) + `::uuid)`
		args = append(args, claims.UserID)
	} else if publishedOnly {
		query += ` AND d.is_published = true`
	}

	if category != "" {
		argCount++
		query += ` AND d.category = $` + string(rune('0'+argCount))
		args = append(args, category)
	}

	if tag != "" {
		argCount++
		query += ` AND $` + string(rune('0'+argCount)) + ` = ANY(d.tags)`
		args = append(args, tag)
	}

	if assetID != "" {
		argCount++
		query += ` AND $` + string(rune('0'+argCount)) + ` = ANY(d.tags)`
		args = append(args, "asset-"+assetID)
	}

	if search != "" {
		argCount++
		query += ` AND (d.title ILIKE $` + string(rune('0'+argCount)) + ` OR d.content ILIKE $` + string(rune('0'+argCount)) + `)`
		args = append(args, "%"+search+"%")
	}

	query += ` ORDER BY d.updated_at DESC LIMIT 100`

	rows, err := server.db.QueryContext(c.Request.Context(), query, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch documentation pages")
		return
	}
	defer rows.Close()

	type docPage struct {
		ID            string    `json:"id"`
		Title         string    `json:"title"`
		Content       string    `json:"content"`
		Category      string    `json:"category"`
		AuthorID      string    `json:"authorId"`
		Tags          []string  `json:"tags"`
		IsPublished   bool      `json:"isPublished"`
		ViewCount     int       `json:"viewCount"`
		HelpfulCount  int       `json:"helpfulCount"`
		CreatedAt     time.Time `json:"createdAt"`
		UpdatedAt     time.Time `json:"updatedAt"`
		AuthorName    string    `json:"authorName"`
		AuthorEmail   string    `json:"authorEmail"`
	}

	pages := make([]docPage, 0)
	for rows.Next() {
		var page docPage
		var tagsRaw []byte
		var authorName, authorEmail sql.NullString

		err := rows.Scan(
			&page.ID, &page.Title, &page.Content, &page.Category, &page.AuthorID,
			&tagsRaw, &page.IsPublished, &page.ViewCount, &page.HelpfulCount,
			&page.CreatedAt, &page.UpdatedAt,
			&authorName, &authorEmail,
		)
		if err != nil {
			continue
		}

		if len(tagsRaw) > 0 {
			_ = server.db.QueryRow(`SELECT ARRAY(SELECT jsonb_array_elements_text($1::jsonb))`, tagsRaw).Scan(&page.Tags)
		}
		if page.Tags == nil {
			page.Tags = make([]string, 0)
		}

		page.AuthorName = authorName.String
		page.AuthorEmail = authorEmail.String

		pages = append(pages, page)
	}

	httpx.JSON(c, http.StatusOK, gin.H{"pages": pages, "count": len(pages)})
}

// GET /api/docs/pages/:id - Get a single documentation page
func (server *apiServer) getDocsPage(c *gin.Context) {
	claims := middleware.CurrentClaims(c)
	pageID := strings.TrimSpace(c.Param("id"))

	query := `
		SELECT 
			d.id, d.title, d.content, d.category, d.author_id,
			d.tags, d.is_published, d.view_count, d.helpful_count,
			d.created_at, d.updated_at,
			u.name as author_name, u.email as author_email
		FROM it_docs d
		LEFT JOIN users u ON u.id = d.author_id
		WHERE d.id = $1::uuid
	`

	var page struct {
		ID            string    `json:"id"`
		Title         string    `json:"title"`
		Content       string    `json:"content"`
		Category      string    `json:"category"`
		AuthorID      string    `json:"authorId"`
		Tags          []string  `json:"tags"`
		IsPublished   bool      `json:"isPublished"`
		ViewCount     int       `json:"viewCount"`
		HelpfulCount  int       `json:"helpfulCount"`
		CreatedAt     time.Time `json:"createdAt"`
		UpdatedAt     time.Time `json:"updatedAt"`
		AuthorName    string    `json:"authorName"`
		AuthorEmail   string    `json:"authorEmail"`
	}

	var tagsRaw []byte
	var authorName, authorEmail sql.NullString

	err := server.db.QueryRowContext(c.Request.Context(), query, pageID).Scan(
		&page.ID, &page.Title, &page.Content, &page.Category, &page.AuthorID,
		&tagsRaw, &page.IsPublished, &page.ViewCount, &page.HelpfulCount,
		&page.CreatedAt, &page.UpdatedAt,
		&authorName, &authorEmail,
	)
	if err == sql.ErrNoRows {
		httpx.Error(c, http.StatusNotFound, "documentation page not found")
		return
	}
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch documentation page")
		return
	}

	// Check permissions - if not published, must be author or admin/it_team
	if !page.IsPublished && page.AuthorID != claims.UserID && claims.Role != "super_admin" && claims.Role != "it_team" {
		httpx.Error(c, http.StatusNotFound, "documentation page not found")
		return
	}

	if len(tagsRaw) > 0 {
		_ = server.db.QueryRow(`SELECT ARRAY(SELECT jsonb_array_elements_text($1::jsonb))`, tagsRaw).Scan(&page.Tags)
	}
	if page.Tags == nil {
		page.Tags = make([]string, 0)
	}

	page.AuthorName = authorName.String
	page.AuthorEmail = authorEmail.String

	// Increment view count
	_, _ = server.db.ExecContext(c.Request.Context(), `UPDATE it_docs SET view_count = view_count + 1 WHERE id = $1::uuid`, pageID)

	httpx.JSON(c, http.StatusOK, page)
}

// POST /api/docs/pages - Create a new documentation page
func (server *apiServer) createDocsPage(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	claims := middleware.CurrentClaims(c)

	var input struct {
		Title       string   `json:"title" binding:"required"`
		Content     string   `json:"content" binding:"required"`
		Category    string   `json:"category" binding:"required"`
		Tags        []string `json:"tags"`
		IsPublished bool     `json:"isPublished"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid documentation page data")
		return
	}

	input.Title = strings.TrimSpace(input.Title)
	input.Content = strings.TrimSpace(input.Content)
	input.Category = strings.TrimSpace(input.Category)

	if input.Title == "" || input.Content == "" || input.Category == "" {
		httpx.Error(c, http.StatusBadRequest, "title, content, and category are required")
		return
	}

	if input.Tags == nil {
		input.Tags = make([]string, 0)
	}

	var pageID string
	err := server.db.QueryRowContext(c.Request.Context(), `
		INSERT INTO it_docs (title, content, category, author_id, tags, is_published)
		VALUES ($1, $2, $3, $4::uuid, $5, $6)
		RETURNING id
	`, input.Title, input.Content, input.Category, claims.UserID, input.Tags, input.IsPublished).Scan(&pageID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to create documentation page")
		return
	}

	httpx.JSON(c, http.StatusCreated, gin.H{
		"id":          pageID,
		"title":       input.Title,
		"category":    input.Category,
		"isPublished": input.IsPublished,
		"createdAt":   time.Now().UTC(),
	})
}

// PUT /api/docs/pages/:id - Update a documentation page
func (server *apiServer) updateDocsPage(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	pageID := strings.TrimSpace(c.Param("id"))

	var input struct {
		Title       string   `json:"title"`
		Content     string   `json:"content"`
		Category    string   `json:"category"`
		Tags        []string `json:"tags"`
		IsPublished *bool    `json:"isPublished"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid documentation page data")
		return
	}

	// Build dynamic update query
	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argCount := 0

	if input.Title != "" {
		argCount++
		updates = append(updates, "title = $"+string(rune('0'+argCount)))
		args = append(args, strings.TrimSpace(input.Title))
	}

	if input.Content != "" {
		argCount++
		updates = append(updates, "content = $"+string(rune('0'+argCount)))
		args = append(args, strings.TrimSpace(input.Content))
	}

	if input.Category != "" {
		argCount++
		updates = append(updates, "category = $"+string(rune('0'+argCount)))
		args = append(args, strings.TrimSpace(input.Category))
	}

	if input.Tags != nil {
		argCount++
		updates = append(updates, "tags = $"+string(rune('0'+argCount)))
		args = append(args, input.Tags)
	}

	if input.IsPublished != nil {
		argCount++
		updates = append(updates, "is_published = $"+string(rune('0'+argCount)))
		args = append(args, *input.IsPublished)
	}

	if len(updates) == 0 {
		httpx.Error(c, http.StatusBadRequest, "no fields to update")
		return
	}

	updates = append(updates, "updated_at = NOW()")
	argCount++
	args = append(args, pageID)

	query := "UPDATE it_docs SET " + strings.Join(updates, ", ") + " WHERE id = $" + string(rune('0'+argCount)) + "::uuid"

	result, err := server.db.ExecContext(c.Request.Context(), query, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to update documentation page")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		httpx.Error(c, http.StatusNotFound, "documentation page not found")
		return
	}

	httpx.JSON(c, http.StatusOK, gin.H{"id": pageID, "updated": true})
}

// DELETE /api/docs/pages/:id - Delete a documentation page
func (server *apiServer) deleteDocsPage(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	pageID := strings.TrimSpace(c.Param("id"))

	result, err := server.db.ExecContext(c.Request.Context(), `DELETE FROM it_docs WHERE id = $1::uuid`, pageID)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to delete documentation page")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		httpx.Error(c, http.StatusNotFound, "documentation page not found")
		return
	}

	httpx.JSON(c, http.StatusOK, gin.H{"id": pageID, "deleted": true})
}

// GET /api/assets/:id/docs - Get documentation pages linked to an asset
func (server *apiServer) getAssetDocs(c *gin.Context) {
	assetID := strings.TrimSpace(c.Param("id"))

	// Check asset exists and user has permission
	asset, err := server.fetchAsset(assetID)
	if err != nil {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}
	if !server.entityAllowedByID(c, asset.EntityID) {
		httpx.Error(c, http.StatusNotFound, "asset not found")
		return
	}

	// Fetch docs with asset tag
	rows, err := server.db.QueryContext(c.Request.Context(), `
		SELECT 
			d.id, d.title, d.category, d.tags, d.is_published,
			d.view_count, d.helpful_count, d.updated_at,
			u.name as author_name
		FROM it_docs d
		LEFT JOIN users u ON u.id = d.author_id
		WHERE $1 = ANY(d.tags) AND d.is_published = true
		ORDER BY d.updated_at DESC
	`, "asset-"+assetID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch asset documentation")
		return
	}
	defer rows.Close()

	type assetDoc struct {
		ID           string    `json:"id"`
		Title        string    `json:"title"`
		Category     string    `json:"category"`
		Tags         []string  `json:"tags"`
		IsPublished  bool      `json:"isPublished"`
		ViewCount    int       `json:"viewCount"`
		HelpfulCount int       `json:"helpfulCount"`
		UpdatedAt    time.Time `json:"updatedAt"`
		AuthorName   string    `json:"authorName"`
	}

	docs := make([]assetDoc, 0)
	for rows.Next() {
		var doc assetDoc
		var tagsRaw []byte
		var authorName sql.NullString

		err := rows.Scan(
			&doc.ID, &doc.Title, &doc.Category, &tagsRaw, &doc.IsPublished,
			&doc.ViewCount, &doc.HelpfulCount, &doc.UpdatedAt, &authorName,
		)
		if err != nil {
			continue
		}

		if len(tagsRaw) > 0 {
			_ = server.db.QueryRow(`SELECT ARRAY(SELECT jsonb_array_elements_text($1::jsonb))`, tagsRaw).Scan(&doc.Tags)
		}
		if doc.Tags == nil {
			doc.Tags = make([]string, 0)
		}

		doc.AuthorName = authorName.String
		docs = append(docs, doc)
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"assetId": assetID,
		"docs":    docs,
		"count":   len(docs),
	})
}
