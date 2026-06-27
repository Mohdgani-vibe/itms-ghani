package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"itms/backend/internal/platform/httpx"
	"itms/backend/internal/platform/middleware"
)

// MFA/TOTP handlers

// POST /api/auth/mfa/setup - Generate TOTP secret and return QR code URL
func (server *apiServer) setupMFA(c *gin.Context) {
	claims := middleware.CurrentClaims(c)

	// Fetch user to check if MFA already enabled
	var mfaEnabled bool
	var existingSecret sql.NullString
	err := server.db.QueryRowContext(c.Request.Context(), `
		SELECT mfa_enabled, totp_secret FROM users WHERE id = $1::uuid
	`, claims.UserID).Scan(&mfaEnabled, &existingSecret)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch user")
		return
	}

	// If MFA already enabled, require current verification first (security best practice)
	if mfaEnabled {
		httpx.Error(c, http.StatusBadRequest, "MFA is already enabled. To reset, contact your administrator.")
		return
	}

	// Generate new TOTP secret
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "ITMS",
		AccountName: claims.Email,
		SecretSize:  32, // 256-bit secret
		Algorithm:   otp.AlgorithmSHA256,
		Period:      30,
		Digits:      6,
	})
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to generate MFA secret")
		return
	}

	// Generate backup codes (8 codes, each 10 digits)
	backupCodes := make([]string, 8)
	for i := 0; i < 8; i++ {
		code, err := generateBackupCode()
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "failed to generate backup codes")
			return
		}
		backupCodes[i] = code
	}

	// Store secret and backup codes in database (not yet enabled)
	_, err = server.db.ExecContext(c.Request.Context(), `
		UPDATE users 
		SET totp_secret = $1, mfa_backup_codes = $2, mfa_enabled = false
		WHERE id = $3::uuid
	`, key.Secret(), backupCodes, claims.UserID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to save MFA configuration")
		return
	}

	// Log to audit
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "mfa_setup",
		TargetType: "user",
		TargetID:   claims.UserID,
		Detail:     gin.H{"email": claims.Email},
	})

	// Return QR code URL and backup codes
	httpx.JSON(c, http.StatusOK, gin.H{
		"secret":      key.Secret(),
		"qrCodeURL":   key.URL(),
		"backupCodes": backupCodes,
		"enabled":     false,
		"message":     "Scan QR code with authenticator app, then verify with a code to enable MFA",
	})
}

// POST /api/auth/mfa/verify - Verify TOTP code and enable MFA
func (server *apiServer) verifyMFA(c *gin.Context) {
	claims := middleware.CurrentClaims(c)

	var input struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "code is required")
		return
	}

	code := strings.TrimSpace(input.Code)
	if code == "" {
		httpx.Error(c, http.StatusBadRequest, "code is required")
		return
	}

	// Fetch user's TOTP secret and backup codes
	var totpSecret sql.NullString
	var backupCodes []string
	var mfaEnabled bool
	err := server.db.QueryRowContext(c.Request.Context(), `
		SELECT totp_secret, COALESCE(mfa_backup_codes, '{}'), mfa_enabled 
		FROM users WHERE id = $1::uuid
	`, claims.UserID).Scan(&totpSecret, &backupCodes, &mfaEnabled)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch MFA configuration")
		return
	}

	if !totpSecret.Valid || totpSecret.String == "" {
		httpx.Error(c, http.StatusBadRequest, "MFA not configured. Setup MFA first.")
		return
	}

	// Check if it's a backup code
	isBackupCode := false
	if len(code) == 10 { // Backup codes are 10 digits
		for i, backupCode := range backupCodes {
			if backupCode == code {
				isBackupCode = true
				// Remove used backup code
				backupCodes = append(backupCodes[:i], backupCodes[i+1:]...)
				break
			}
		}
	}

	// Verify TOTP code or backup code
	valid := false
	if isBackupCode {
		valid = true
		// Update backup codes (remove used code)
		_, err = server.db.ExecContext(c.Request.Context(), `
			UPDATE users SET mfa_backup_codes = $1 WHERE id = $2::uuid
		`, backupCodes, claims.UserID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "failed to update backup codes")
			return
		}
	} else {
		// Verify TOTP code
		valid = totp.Validate(code, totpSecret.String)
	}

	if !valid {
		middleware.TagAudit(c, middleware.AuditMeta{
			Action:     "mfa_verify_failed",
			TargetType: "user",
			TargetID:   claims.UserID,
			Detail:     gin.H{"email": claims.Email},
		})
		httpx.Error(c, http.StatusUnauthorized, "invalid MFA code")
		return
	}

	// Enable MFA if not already enabled
	if !mfaEnabled {
		_, err = server.db.ExecContext(c.Request.Context(), `
			UPDATE users SET mfa_enabled = true WHERE id = $1::uuid
		`, claims.UserID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "failed to enable MFA")
			return
		}
	}

	// Log to audit
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "mfa_verify_success",
		TargetType: "user",
		TargetID:   claims.UserID,
		Detail:     gin.H{"email": claims.Email, "method": map[bool]string{true: "backup_code", false: "totp"}[isBackupCode]},
	})

	httpx.JSON(c, http.StatusOK, gin.H{
		"verified":        true,
		"mfaEnabled":      true,
		"backupCodesLeft": len(backupCodes),
	})
}

// POST /api/auth/mfa/disable - Disable MFA (requires current verification)
func (server *apiServer) disableMFA(c *gin.Context) {
	if !server.requireRoles(c, "super_admin") {
		return
	}

	var input struct {
		UserID string `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		httpx.Error(c, http.StatusBadRequest, "userId is required")
		return
	}

	// Only super_admin can disable another user's MFA
	_, err := server.db.ExecContext(c.Request.Context(), `
		UPDATE users 
		SET mfa_enabled = false, totp_secret = NULL, mfa_backup_codes = NULL
		WHERE id = $1::uuid
	`, input.UserID)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to disable MFA")
		return
	}

	claims := middleware.CurrentClaims(c)
	middleware.TagAudit(c, middleware.AuditMeta{
		Action:     "mfa_disabled_by_admin",
		TargetType: "user",
		TargetID:   input.UserID,
		Detail:     gin.H{"admin_id": claims.UserID, "admin_email": claims.Email},
	})

	httpx.JSON(c, http.StatusOK, gin.H{"disabled": true})
}

// GET /api/auth/mfa/status - Get current MFA status
func (server *apiServer) getMFAStatus(c *gin.Context) {
	claims := middleware.CurrentClaims(c)

	var mfaEnabled bool
	var backupCodes []string
	err := server.db.QueryRowContext(c.Request.Context(), `
		SELECT mfa_enabled, COALESCE(mfa_backup_codes, '{}')
		FROM users WHERE id = $1::uuid
	`, claims.UserID).Scan(&mfaEnabled, &backupCodes)

	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, "failed to fetch MFA status")
		return
	}

	httpx.JSON(c, http.StatusOK, gin.H{
		"mfaEnabled":      mfaEnabled,
		"backupCodesLeft": len(backupCodes),
	})
}

// POST /api/auth/login/verify-mfa - Verify MFA during login (two-step login)
func (server *apiServer) loginVerifyMFA(c *gin.Context) {
	var input struct {
		Email string `json:"email" binding:"required"`
		Code  string `json:"code" binding:"required"`
	}
	if err := bindJSONWithLimit(c, &input, 32<<10); err != nil {
		httpx.Error(c, http.StatusBadRequest, "invalid MFA verification payload")
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	code := strings.TrimSpace(input.Code)

	limiterKey := authLimiterKey(c, email)
	if !server.authLimiter.Allow(limiterKey) {
		httpx.Error(c, http.StatusTooManyRequests, "too many login attempts, try again later")
		return
	}

	// Fetch user
	user, err := server.fetchUserByEmail(email)
	if err != nil {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	if !userIsActive(user) {
		server.rejectAuthAttempt(c, limiterKey)
		return
	}

	if !user.MFAEnabled {
		httpx.Error(c, http.StatusBadRequest, "MFA is not enabled for this user")
		return
	}

	// Check if it's a backup code
	isBackupCode := false
	backupCodes := user.MFABackupCodes
	if len(code) == 10 { // Backup codes are 10 digits
		for i, backupCode := range backupCodes {
			if backupCode == code {
				isBackupCode = true
				// Remove used backup code
				backupCodes = append(backupCodes[:i], backupCodes[i+1:]...)
				break
			}
		}
	}

	// Verify TOTP code or backup code
	valid := false
	if isBackupCode {
		valid = true
		// Update backup codes (remove used code)
		_, err = server.db.ExecContext(c.Request.Context(), `
			UPDATE users SET mfa_backup_codes = $1 WHERE id = $2::uuid
		`, backupCodes, user.ID)
		if err != nil {
			httpx.Error(c, http.StatusInternalServerError, "failed to update backup codes")
			return
		}
	} else {
		// Verify TOTP code
		if user.TOTPSecret.Valid && user.TOTPSecret.String != "" {
			valid = totp.Validate(code, user.TOTPSecret.String)
		}
	}

	if !valid {
		server.rejectAuthAttempt(c, limiterKey)
		middleware.TagAudit(c, middleware.AuditMeta{
			Action:     "login_mfa_failed",
			TargetType: "user",
			TargetID:   user.ID,
			Detail:     gin.H{"email": email},
		})
		return
	}

	// MFA verified - issue JWT token
	server.authLimiter.Reset(limiterKey)
	server.issueAuthResponse(c, user, "password_mfa")
}

// Helper: generate secure backup code (10 digits)
func generateBackupCode() (string, error) {
	bytes := make([]byte, 5) // 5 bytes = 10 hex chars
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	// Convert to base64 and take first 10 alphanumeric characters
	encoded := base64.URLEncoding.EncodeToString(bytes)
	// Replace non-digits with digits from hash
	code := ""
	for _, char := range encoded {
		if char >= '0' && char <= '9' {
			code += string(char)
		} else if char >= 'A' && char <= 'Z' {
			code += string('0' + (char-'A')%10)
		} else if char >= 'a' && char <= 'z' {
			code += string('0' + (char-'a')%10)
		}
		if len(code) >= 10 {
			break
		}
	}
	if len(code) < 10 {
		// Pad with timestamp-based digits
		timestamp := time.Now().UnixNano()
		for len(code) < 10 {
			code += string('0' + byte(timestamp%10))
			timestamp /= 10
		}
	}
	return code[:10], nil
}
