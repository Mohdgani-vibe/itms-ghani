package api

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

// Vault encryption/decryption helpers

// deriveEncryptionKey derives a 32-byte AES-256 key from the configured key
func deriveEncryptionKey(configKey string) ([]byte, error) {
	if strings.TrimSpace(configKey) == "" {
		return nil, fmt.Errorf("VAULT_ENCRYPTION_KEY is not configured")
	}
	hash := sha256.Sum256([]byte(configKey))
	return hash[:], nil
}

// encryptAESGCM encrypts plaintext using AES-256-GCM
func encryptAESGCM(plaintext string, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return ciphertext, nil
}

// decryptAESGCM decrypts ciphertext using AES-256-GCM
func decryptAESGCM(ciphertext []byte, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// Vault API handlers

// GET /api/vault - List all vault credentials (passwords redacted)
func (server *apiServer) listVaultCredentials(c *gin.Context) {
	claims := middleware.CurrentClaims(c)

	// Only super_admin, it_team, and auditor can view vault entries
	if claims.Role != "super_admin" && claims.Role != "it_team" && claims.Role != "auditor" {
		httpx.Error(c, http.StatusForbidden, "insufficient permissions to access vault")
		return
	}

	search := strings.TrimSpace(c.Query("search"))
	credType := strings.TrimSpace(c.Query("type"))
	assetID := strings.TrimSpace(c.Query("assetId"))

	query := `
		SELECT 
			v.id, v.name, v.username, v.credential_type, 
			v.asset_id, v.url, v.created_by, v.last_accessed_at, 
			v.access_count, v.tags, v.created_at, v.updated_at,
			u.name as created_by_name, u.email as created_by_email,
			a.name as asset_name, a.asset_tag
		FROM vault_credentials v
		LEFT JOIN users u ON u.id = v.created_by
		LEFT JOIN assets a ON a.id = v.asset_id
		WHERE 1=1
	`
	args := make([]interface{}, 0)
	argCount := 0

	if search != "" {
		argCount++
		query += fmt.Sprintf(` AND (v.name ILIKE $%d OR v.username ILIKE $%d)`, argCount, argCount)
		args = append(args, "%"+search+"%")
	}

	if credType != "" {
		argCount++
		query += fmt.Sprintf(` AND v.credential_type = $%d`, argCount)
		args = append(args, credType)
	}

	if assetID != "" {
		argCount++
		query += fmt.Sprintf(` AND v.asset_id = $%d::uuid`, argCount)
		args = append(args, assetID)
	}

	query += ` ORDER BY v.updated_at DESC LIMIT 200`

	rows, err := server.db.QueryContext(c.Request.Context(), query, args...)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch vault credentials")
		return
	}
	defer rows.Close()

	type vaultEntry struct {
		ID               string     `json:"id"`
		Name             string     `json:"name"`
		Username         string     `json:"username"`
		Password         string     `json:"password"` // Always redacted
		CredentialType   string     `json:"credentialType"`
		AssetID          *string    `json:"assetId"`
		URL              *string    `json:"url"`
		CreatedBy        string     `json:"createdBy"`
		LastAccessedAt   *time.Time `json:"lastAccessedAt"`
		AccessCount      int        `json:"accessCount"`
		Tags             []string   `json:"tags"`
		CreatedAt        time.Time  `json:"createdAt"`
		UpdatedAt        time.Time  `json:"updatedAt"`
		CreatedByName    string     `json:"createdByName"`
		CreatedByEmail   string     `json:"createdByEmail"`
		AssetName        *string    `json:"assetName"`
		AssetTag         *string    `json:"assetTag"`
	}

	entries := make([]vaultEntry, 0)
	for rows.Next() {
		var entry vaultEntry
		var tagsRaw []byte
		var createdByName, createdByEmail sql.NullString
		var assetName, assetTag sql.NullString
		var lastAccessedAt sql.NullTime

		err := rows.Scan(
			&entry.ID, &entry.Name, &entry.Username, &entry.CredentialType,
			&entry.AssetID, &entry.URL, &entry.CreatedBy, &lastAccessedAt,
			&entry.AccessCount, &tagsRaw, &entry.CreatedAt, &entry.UpdatedAt,
			&createdByName, &createdByEmail, &assetName, &assetTag,
		)
		if err != nil {
			continue
		}

		// Redact password - never send encrypted data to frontend
		entry.Password = "••••••••"

		if lastAccessedAt.Valid {
			entry.LastAccessedAt = &lastAccessedAt.Time
		}

		if len(tagsRaw) > 0 {
			_ = server.db.QueryRow(`SELECT ARRAY(SELECT jsonb_array_elements_text($1::jsonb))`, tagsRaw).Scan(&entry.Tags)
		}
		if entry.Tags == nil {
			entry.Tags = make([]string, 0)
		}

		entry.CreatedByName = createdByName.String
		entry.CreatedByEmail = createdByEmail.String

		if assetName.Valid {
			entry.AssetName = &assetName.String
		}
		if assetTag.Valid {
			entry.AssetTag = &assetTag.String
		}

		entries = append(entries, entry)
	}

	httpx.JSON(c, http.StatusOK, gin.H{"credentials": entries, "count": len(entries)})
}

// POST /api/vault - Create a new vault credential
func (server *apiServer) createVaultCredential(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	claims := middleware.CurrentClaims(c)

	var input struct {
		Name           string   `json:"name" binding:"required"`
		Username       string   `json:"username"`
		Password       string   `json:"password" binding:"required"`
		Notes          string   `json:"notes"`
		CredentialType string   `json:"credentialType"`
		AssetID        *string  `json:"assetId"`
		URL            *string  `json:"url"`
		Tags           []string `json:"tags"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid vault credential data")
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Username = strings.TrimSpace(input.Username)
	input.Password = strings.TrimSpace(input.Password)
	input.Notes = strings.TrimSpace(input.Notes)
	input.CredentialType = strings.TrimSpace(input.CredentialType)

	if input.Name == "" || input.Password == "" {
		httpx.Error(c, http.StatusBadRequest, "name and password are required")
		return
	}

	if input.CredentialType == "" {
		input.CredentialType = "password"
	}

	// Validate credential type
	validTypes := map[string]bool{
		"password":        true,
		"api_key":         true,
		"ssh_key":         true,
		"service_account": true,
		"database":        true,
		"certificate":     true,
	}
	if !validTypes[input.CredentialType] {
		httpx.Error(c, http.StatusBadRequest, "invalid credential type")
		return
	}

	// Derive encryption key
	key, err := deriveEncryptionKey(server.config.VaultEncryptionKey)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "vault encryption not configured")
		return
	}

	// Encrypt password
	encryptedPassword, err := encryptAESGCM(input.Password, key)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to encrypt password")
		return
	}

	// Encrypt notes if provided
	var encryptedNotes []byte
	if input.Notes != "" {
		encryptedNotes, err = encryptAESGCM(input.Notes, key)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "failed to encrypt notes")
			return
		}
	}

	if input.Tags == nil {
		input.Tags = make([]string, 0)
	}

	var credentialID string
	err = server.db.QueryRowContext(c.Request.Context(), `
		INSERT INTO vault_credentials 
		(name, username, encrypted_password, encrypted_notes, credential_type, asset_id, url, created_by, tags)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid, NULLIF($7, ''), $8::uuid, $9)
		RETURNING id
	`, input.Name, input.Username, encryptedPassword, encryptedNotes, input.CredentialType,
		input.AssetID, input.URL, claims.UserID, input.Tags).Scan(&credentialID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to create vault credential")
		return
	}

	// Log to audit
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "vault_create",
		TargetType: "vault_credential",
		TargetID:   credentialID,
		Detail:     gin.H{"name": input.Name, "type": input.CredentialType},
	})

	httpx.JSON(c, http.StatusCreated, gin.H{
		"id":             credentialID,
		"name":           input.Name,
		"credentialType": input.CredentialType,
		"created":        true,
	})
}

// POST /api/vault/:id/reveal - Reveal (decrypt) a credential
func (server *apiServer) revealVaultCredential(c *gin.Context) {
	claims := middleware.CurrentClaims(c)

	// Only super_admin and it_team can reveal credentials
	// Auditor can see entries but NOT reveal passwords
	if claims.Role != "super_admin" && claims.Role != "it_team" {
		httpx.Error(c, http.StatusForbidden, "insufficient permissions to reveal credentials")
		return
	}

	credentialID := strings.TrimSpace(c.Param("id"))

	// Fetch encrypted credential
	var encryptedPassword, encryptedNotes []byte
	var name, username, credType string
	err := server.db.QueryRowContext(c.Request.Context(), `
		SELECT name, username, encrypted_password, encrypted_notes, credential_type
		FROM vault_credentials
		WHERE id = $1::uuid
	`, credentialID).Scan(&name, &username, &encryptedPassword, &encryptedNotes, &credType)

	if err == sql.ErrNoRows {
		httpx.Error(c, http.StatusNotFound, "credential not found")
		return
	}
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch credential")
		return
	}

	// Derive encryption key
	key, err := deriveEncryptionKey(server.config.VaultEncryptionKey)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "vault encryption not configured")
		return
	}

	// Decrypt password
	password, err := decryptAESGCM(encryptedPassword, key)
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to decrypt password")
		return
	}

	// Decrypt notes if present
	var notes string
	if len(encryptedNotes) > 0 {
		notes, err = decryptAESGCM(encryptedNotes, key)
		if err != nil {
			// Log error but don't fail - notes are optional
			notes = ""
		}
	}

	// Log access to vault_access_log
	clientIP := c.ClientIP()
	_, _ = server.db.ExecContext(c.Request.Context(), `
		INSERT INTO vault_access_log (credential_id, user_id, access_type, ip_address)
		VALUES ($1::uuid, $2::uuid, 'reveal', $3::inet)
	`, credentialID, claims.UserID, clientIP)

	// Update last_accessed_at and increment access_count (trigger will handle this)
	_, _ = server.db.ExecContext(c.Request.Context(), `
		UPDATE vault_credentials 
		SET last_accessed_at = NOW(), access_count = access_count + 1
		WHERE id = $1::uuid
	`, credentialID)

	// Log to audit
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "vault_reveal",
		TargetType: "vault_credential",
		TargetID:   credentialID,
		Detail:     gin.H{"name": name, "type": credType, "ip": clientIP},
	})

	httpx.JSON(c, http.StatusOK, gin.H{
		"id":             credentialID,
		"name":           name,
		"username":       username,
		"password":       password,
		"notes":          notes,
		"credentialType": credType,
		"revealed":       true,
	})
}

// DELETE /api/vault/:id - Delete a vault credential
func (server *apiServer) deleteVaultCredential(c *gin.Context) {
	if !server.requireRoles(c, "super_admin", "it_team") {
		return
	}

	credentialID := strings.TrimSpace(c.Param("id"))

	// Get credential name for audit
	var name string
	_ = server.db.QueryRowContext(c.Request.Context(), `SELECT name FROM vault_credentials WHERE id = $1::uuid`, credentialID).Scan(&name)

	result, err := server.db.ExecContext(c.Request.Context(), `
		DELETE FROM vault_credentials WHERE id = $1::uuid
	`, credentialID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to delete credential")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		httpx.Error(c, http.StatusNotFound, "credential not found")
		return
	}

	// Log to audit
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "vault_delete",
		TargetType: "vault_credential",
		TargetID:   credentialID,
		Detail:     gin.H{"name": name},
	})

	httpx.JSON(c, http.StatusOK, gin.H{"id": credentialID, "deleted": true})
}

// GET /api/vault/:id/access-log - Get access log for a credential (admin only)
func (server *apiServer) getVaultAccessLog(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}

	credentialID := strings.TrimSpace(c.Param("id"))

	rows, err := server.db.QueryContext(c.Request.Context(), `
		SELECT 
			l.id, l.access_type, l.ip_address, l.created_at,
			u.name as user_name, u.email as user_email
		FROM vault_access_log l
		LEFT JOIN users u ON u.id = l.user_id
		WHERE l.credential_id = $1::uuid
		ORDER BY l.created_at DESC
		LIMIT 100
	`, credentialID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch access log")
		return
	}
	defer rows.Close()

	type accessLogEntry struct {
		ID         string    `json:"id"`
		AccessType string    `json:"accessType"`
		IPAddress  *string   `json:"ipAddress"`
		CreatedAt  time.Time `json:"createdAt"`
		UserName   string    `json:"userName"`
		UserEmail  string    `json:"userEmail"`
	}

	entries := make([]accessLogEntry, 0)
	for rows.Next() {
		var entry accessLogEntry
		var ipAddr sql.NullString
		var userName, userEmail sql.NullString

		err := rows.Scan(
			&entry.ID, &entry.AccessType, &ipAddr, &entry.CreatedAt,
			&userName, &userEmail,
		)
		if err != nil {
			continue
		}

		if ipAddr.Valid {
			entry.IPAddress = &ipAddr.String
		}
		entry.UserName = userName.String
		entry.UserEmail = userEmail.String

		entries = append(entries, entry)
	}

	httpx.JSON(c, http.StatusOK, gin.H{"entries": entries, "count": len(entries)})
}
