package middleware

import (
	"bytes"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"itms/backend/internal/platform/authn"
	"itms/backend/internal/platform/httpx"
)

const (
	ClaimsKey    = "claims"
	AuditMetaKey = "audit_meta"
	AuditBodyKey = "audit_body"
	CSRFTokenKey = "csrf_token"
)

type AuditMeta struct {
	Action         string
	TargetType     string
	TargetID       string
	Detail         any
	ActorID        string
	EntityID       string
	AuthMethod     string
	PersistOnError bool
}

// Rate limiting configuration
type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	cleanup  time.Duration
}

type visitor struct {
	requests []time.Time
	blocked  bool
}

var (
	authLimiter = &rateLimiter{
		visitors: make(map[string]*visitor),
		cleanup:  time.Minute,
	}
	apiLimiter = &rateLimiter{
		visitors: make(map[string]*visitor),
		cleanup:  time.Minute,
	}
)

// Sensitive field patterns for audit log masking
var sensitiveKeys = []string{
	"password", "passwd", "pwd",
	"token", "access_token", "refresh_token", "bearer",
	"authorization", "auth",
	"secret", "api_key", "apikey", "api-key",
	"otp", "mfa", "totp", "code", "verification_code",
	"private_key", "privatekey", "private-key",
	"client_secret", "clientsecret",
}

// RateLimit implements rate limiting middleware
// authMode: limits auth endpoints (5 requests per minute per IP)
// apiMode: limits sensitive API endpoints (60 requests per minute per IP)
func RateLimit(authMode bool) gin.HandlerFunc {
	limiter := apiLimiter
	maxRequests := 60
	window := time.Minute

	if authMode {
		limiter = authLimiter
		maxRequests = 5
		window = time.Minute
	}

	return func(c *gin.Context) {
		ip := clientIP(c)
		limiter.mu.Lock()
		
		v, exists := limiter.visitors[ip]
		if !exists {
			v = &visitor{requests: make([]time.Time, 0)}
			limiter.visitors[ip] = v
		}

		// Clean old requests outside window
		now := time.Now()
		cutoff := now.Add(-window)
		newRequests := make([]time.Time, 0)
		for _, t := range v.requests {
			if t.After(cutoff) {
				newRequests = append(newRequests, t)
			}
		}
		v.requests = newRequests

		// Check rate limit
		if len(v.requests) >= maxRequests {
			v.blocked = true
			limiter.mu.Unlock()
			c.Header("Retry-After", "60")
			httpx.Error(c, http.StatusTooManyRequests, "rate limit exceeded")
			c.Abort()
			return
		}

		v.requests = append(v.requests, now)
		v.blocked = false
		limiter.mu.Unlock()

		c.Next()
	}
}

// Cleanup periodically removes old visitor data
func init() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			cleanupLimiter(authLimiter)
			cleanupLimiter(apiLimiter)
		}
	}()
}

func cleanupLimiter(limiter *rateLimiter) {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	cutoff := time.Now().Add(-10 * time.Minute)
	for ip, v := range limiter.visitors {
		if len(v.requests) == 0 || v.requests[len(v.requests)-1].Before(cutoff) {
			delete(limiter.visitors, ip)
		}
	}
}

// CSRFProtection provides CSRF token validation (future-proofing for cookie-based auth)
// Does NOT break current Bearer token authentication
func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip CSRF for Bearer token auth (current implementation)
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			c.Next()
			return
		}

		// Skip CSRF for GET, HEAD, OPTIONS (safe methods)
		if c.Request.Method == http.MethodGet ||
			c.Request.Method == http.MethodHead ||
			c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		// For cookie-based auth (future), validate CSRF token
		csrfCookie, err := c.Cookie("csrf_token")
		if err != nil {
			// No CSRF cookie yet (first request or Bearer token flow)
			c.Next()
			return
		}

		csrfHeader := c.GetHeader("X-CSRF-Token")
		if csrfHeader == "" {
			httpx.Error(c, http.StatusForbidden, "missing CSRF token")
			c.Abort()
			return
		}

		// Constant-time comparison to prevent timing attacks
		if subtle.ConstantTimeCompare([]byte(csrfCookie), []byte(csrfHeader)) != 1 {
			httpx.Error(c, http.StatusForbidden, "invalid CSRF token")
			c.Abort()
			return
		}

		c.Next()
	}
}

// GenerateCSRFToken creates a new CSRF token
func GenerateCSRFToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func CORS(origin string) gin.HandlerFunc {
	allowedOrigins := make([]string, 0)
	for _, candidate := range strings.Split(origin, ",") {
		trimmed := strings.TrimSpace(candidate)
		if trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}

	return func(c *gin.Context) {
		requestOrigin := strings.TrimSpace(c.GetHeader("Origin"))
		if requestOrigin != "" {
			// Strict origin validation
			if len(allowedOrigins) > 0 && !slices.Contains(allowedOrigins, requestOrigin) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "origin not allowed"})
				return
			}
			c.Header("Access-Control-Allow-Origin", requestOrigin)
			c.Header("Vary", "Origin")
		}
		// Restricted CORS headers - only allow necessary headers
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-CSRF-Token")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "3600") // 1 hour preflight cache
		
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func AuthRequired(manager *authn.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httpx.Error(c, http.StatusUnauthorized, "missing bearer token")
			return
		}
		claims, err := manager.ParseToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			httpx.Error(c, http.StatusUnauthorized, "invalid token")
			return
		}
		c.Set(ClaimsKey, claims)
		c.Next()
	}
}

func Audit(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var maskedBody string
		
		if c.Request.Method == http.MethodPost || c.Request.Method == http.MethodPatch || c.Request.Method == http.MethodDelete {
			if body, err := c.GetRawData(); err == nil && len(body) > 0 {
				// Mask sensitive fields before storing
				maskedBody = maskSensitiveData(string(body))
				c.Set(AuditBodyKey, maskedBody)
				c.Request.Body = ioNopCloser(bytes.NewBuffer(body))
			}
		}

		c.Next()

		value, exists := c.Get(AuditMetaKey)
		if !exists {
			return
		}
		meta, ok := value.(AuditMeta)
		if !ok || meta.Action == "" {
			return
		}
		if c.Writer.Status() >= http.StatusBadRequest && !meta.PersistOnError {
			return
		}

		claims := CurrentClaims(c)
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
			if body, exists := c.Get(AuditBodyKey); exists {
				detail = gin.H{"request": body}
			}
		}
		
		// Ensure detail is also masked if it's a struct
		maskedDetail := maskSensitiveDetail(detail)
		payload, _ := json.Marshal(maskedDetail)

		// Mask authorization header in audit
		authMethod := meta.AuthMethod
		if authMethod == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				authMethod = "Bearer [REDACTED]"
			}
		}

		_, _ = db.Exec(`
			INSERT INTO audit_log (actor_id, entity_id, action, target_type, target_id, detail, ip_address, auth_method)
			VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6::jsonb, NULLIF($7, '')::inet, $8)
		`, actorID, entityID, meta.Action, meta.TargetType, meta.TargetID, string(payload), clientIP(c), authMethod)
	}
}

// maskSensitiveData masks sensitive fields in JSON string
func maskSensitiveData(data string) string {
	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(data), &obj); err != nil {
		return data // Return original if not valid JSON
	}

	masked := maskMapRecursive(obj)
	result, err := json.Marshal(masked)
	if err != nil {
		return data
	}
	return string(result)
}

// maskSensitiveDetail masks sensitive fields in any data structure
func maskSensitiveDetail(detail interface{}) interface{} {
	switch v := detail.(type) {
	case map[string]interface{}:
		return maskMapRecursive(v)
	case gin.H:
		return maskMapRecursive(map[string]interface{}(v))
	default:
		return detail
	}
}

// maskMapRecursive recursively masks sensitive keys in maps
func maskMapRecursive(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	
	for key, value := range m {
		lowerKey := strings.ToLower(key)
		shouldMask := false
		
		// Check if key contains sensitive patterns
		for _, sensitiveKey := range sensitiveKeys {
			if strings.Contains(lowerKey, sensitiveKey) {
				shouldMask = true
				break
			}
		}

		if shouldMask {
			result[key] = "[REDACTED]"
			continue
		}

		// Recursively process nested structures
		switch v := value.(type) {
		case map[string]interface{}:
			result[key] = maskMapRecursive(v)
		case []interface{}:
			masked := make([]interface{}, len(v))
			for i, item := range v {
				if itemMap, ok := item.(map[string]interface{}); ok {
					masked[i] = maskMapRecursive(itemMap)
				} else {
					masked[i] = item
				}
			}
			result[key] = masked
		default:
			result[key] = value
		}
	}
	
	return result
}

func CurrentClaims(c *gin.Context) *authn.Claims {
	value, exists := c.Get(ClaimsKey)
	if !exists {
		return nil
	}
	claims, ok := value.(*authn.Claims)
	if !ok {
		return nil
	}
	return claims
}

func TagAudit(c *gin.Context, meta AuditMeta) {
	c.Set(AuditMetaKey, meta)
}

func RequireRoles(c *gin.Context, allowed ...string) bool {
	claims := CurrentClaims(c)
	if claims == nil {
		httpx.Error(c, http.StatusUnauthorized, "unauthorized")
		return false
	}
	for _, role := range allowed {
		if claims.Role == role {
			return true
		}
	}
	httpx.Error(c, http.StatusForbidden, "forbidden")
	return false
}

func clientIP(c *gin.Context) string {
	forwarded := c.GetHeader("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}
	return c.ClientIP()
}

type nopCloser struct {
	*bytes.Buffer
}

func ioNopCloser(buffer *bytes.Buffer) *nopCloser {
	return &nopCloser{Buffer: buffer}
}

func (closer *nopCloser) Close() error {
	return nil
}

// RequestSizeLimit enforces maximum request body size
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxSize {
			httpx.Error(c, http.StatusRequestEntityTooLarge, "request body too large")
			c.Abort()
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)
		c.Next()
	}
}

// SecurityHeaders adds additional security headers to responses
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Additional backend security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("X-Permitted-Cross-Domain-Policies", "none")
		c.Next()
	}
}

// SuspiciousPatternDetection detects potentially malicious patterns in requests
var suspiciousPatterns = []string{
	"<script", "javascript:", "onerror=", "onload=",
	"../", "..\\\\", // Path traversal
	"union select", "1=1", "' or '1'='1", // SQL injection
	"${", "#{", // Template injection
	"../../../../", // Path traversal
	"cmd.exe", "/bin/sh", "/bin/bash", // Command injection
}

func SuspiciousPatternDetection() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check URL path
		path := strings.ToLower(c.Request.URL.Path)
		for _, pattern := range suspiciousPatterns {
			if strings.Contains(path, strings.ToLower(pattern)) {
				_ = TagAuditSuspicious(c, "suspicious_pattern_in_url", pattern)
				httpx.Error(c, http.StatusBadRequest, "invalid request")
				c.Abort()
				return
			}
		}

		// Check query parameters
		for key, values := range c.Request.URL.Query() {
			for _, value := range values {
				lowerValue := strings.ToLower(value)
				for _, pattern := range suspiciousPatterns {
					if strings.Contains(lowerValue, strings.ToLower(pattern)) {
						_ = TagAuditSuspicious(c, "suspicious_pattern_in_query", pattern)
						httpx.Error(c, http.StatusBadRequest, "invalid request")
						c.Abort()
						return
					}
				}
			}
		}

		c.Next()
	}
}

func TagAuditSuspicious(c *gin.Context, action string, pattern string) error {
	ip := clientIP(c)
	userAgent := c.GetHeader("User-Agent")
	
	TagAudit(c, AuditMeta{
		Action:         action,
		TargetType:     "security",
		Detail:         gin.H{"pattern": pattern, "path": c.Request.URL.Path, "ip": ip, "user_agent": userAgent},
		PersistOnError: true,
	})
	return nil
}

// IPWhitelist allows requests only from whitelisted IPs (optional, for admin endpoints)
func IPWhitelist(allowedIPs []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if len(allowedIPs) == 0 {
			c.Next()
			return
		}

		clientIP := clientIP(c)
		allowed := false
		
		for _, allowedIP := range allowedIPs {
			if clientIP == allowedIP || allowedIP == "*" {
				allowed = true
				break
			}
			// Check CIDR ranges (simplified - just prefix match)
			if strings.HasSuffix(allowedIP, "/24") {
				prefix := strings.TrimSuffix(allowedIP, "/24")
				prefix = prefix[:strings.LastIndex(prefix, ".")]
				if strings.HasPrefix(clientIP, prefix+".") {
					allowed = true
					break
				}
			}
		}

		if !allowed {
			httpx.Error(c, http.StatusForbidden, "access denied from this IP")
			c.Abort()
			return
		}

		c.Next()
	}
}
