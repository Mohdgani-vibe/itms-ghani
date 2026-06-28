# ITMS Security Best Practices

## 🔒 Security First Principles

This document outlines security best practices for the ITMS project. All team members must follow these guidelines.

---

## Table of Contents

1. [Credential Management](#credential-management)
2. [Code Security](#code-security)
3. [Database Security](#database-security)
4. [API Security](#api-security)
5. [Docker Security](#docker-security)
6. [Development Practices](#development-practices)
7. [Production Deployment](#production-deployment)
8. [Incident Response](#incident-response)

---

## Credential Management

### ✅ DO

- **Use environment variables or secrets management** for all credentials
- **Generate strong passwords**: Minimum 32 characters, random
- **Rotate credentials quarterly** and after any suspected compromise
- **Use different credentials** for development, staging, and production
- **Enable MFA** on all critical accounts (GitHub, AWS, database access)
- **Use SSH keys** with passphrases instead of passwords

### ❌ DON'T

- **Never commit credentials** to git (even private repos)
- **Never share passwords** via email, Slack, or chat
- **Never reuse passwords** across services
- **Never use default passwords** in production
- **Never store credentials** in code, comments, or documentation
- **Never log credentials** (check application logs regularly)

### Tools

```bash
# Generate strong passwords
openssl rand -hex 32  # 64 character password

# Check if secrets are in git history
git log -p -S 'password' --all

# Scan for secrets
./scripts/pre-commit.sh
```

---

## Code Security

### Authentication & Authorization

```go
// ✅ GOOD: Role-based access control
func (s *apiServer) requireRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := c.MustGet("user").(*User)
        if !user.HasAnyRole(roles...) {
            c.JSON(403, gin.H{"error": "Forbidden"})
            c.Abort()
            return
        }
        c.Next()
    }
}

// ❌ BAD: No authorization check
func (s *apiServer) deleteAsset(c *gin.Context) {
    // Anyone can delete assets!
    db.Delete(&Asset{}, c.Param("id"))
}
```

### Input Validation

```go
// ✅ GOOD: Validate and sanitize input
func (s *apiServer) createAsset(c *gin.Context) {
    var input struct {
        Name     string `json:"name" binding:"required,min=1,max=255"`
        SerialNo string `json:"serial_no" binding:"required,alphanum"`
    }
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(400, gin.H{"error": "Invalid input"})
        return
    }
    // Proceed with validated input
}

// ❌ BAD: No validation
func (s *apiServer) createAsset(c *gin.Context) {
    var input map[string]interface{}
    c.BindJSON(&input)
    // SQL injection vulnerability!
    db.Exec("INSERT INTO assets (name) VALUES ('" + input["name"].(string) + "')")
}
```

### SQL Injection Prevention

```go
// ✅ GOOD: Use parameterized queries
db.Where("email = ?", email).First(&user)

// ✅ GOOD: Named parameters
db.Where("status = @status AND role = @role", 
    sql.Named("status", status),
    sql.Named("role", role)).Find(&users)

// ❌ BAD: String concatenation
db.Raw("SELECT * FROM users WHERE email = '" + email + "'").Scan(&user)
```

### XSS Prevention

```typescript
// ✅ GOOD: React automatically escapes
<div>{user.name}</div>

// ✅ GOOD: Explicit sanitization
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />

// ❌ BAD: Unescaped HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

---

## Database Security

### Connection Security

```bash
# ✅ GOOD: Use SSL/TLS
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require

# ✅ GOOD: Docker secrets
postgres:
  environment:
    POSTGRES_PASSWORD_FILE: /run/secrets/db_password
  secrets:
    - db_password

# ❌ BAD: Plaintext password in docker-compose
postgres:
  environment:
    POSTGRES_PASSWORD: mypassword
```

### Access Control

```sql
-- ✅ GOOD: Least privilege principle
CREATE USER itms_app WITH PASSWORD 'strong_password';
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO itms_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO itms_app;

-- ❌ BAD: Superuser for application
CREATE USER itms_app WITH SUPERUSER PASSWORD 'password';
```

### Backup Security

```bash
# ✅ GOOD: Encrypted backups
pg_dump itms | gpg --encrypt --recipient security@company.com > backup.sql.gpg

# Store backups off-site (S3, Azure Blob, etc.)
aws s3 cp backup.sql.gpg s3://backups/itms/$(date +%Y%m%d).sql.gpg --sse

# ❌ BAD: Unencrypted backups
pg_dump itms > /tmp/backup.sql
```

---

## API Security

### Rate Limiting

```go
// ✅ GOOD: Rate limit sensitive endpoints
import "github.com/gin-contrib/limiter"

router.Use(limiter.NewRateLimiter(100, time.Minute))

// Stricter limits for authentication
auth := router.Group("/api/auth")
auth.Use(limiter.NewRateLimiter(5, time.Minute))
```

### CORS Configuration

```go
// ✅ GOOD: Restrict origins
router.Use(cors.New(cors.Config{
    AllowOrigins: []string{os.Getenv("FRONTEND_ORIGIN")},
    AllowMethods: []string{"GET", "POST", "PUT", "DELETE"},
    AllowHeaders: []string{"Authorization", "Content-Type"},
}))

// ❌ BAD: Allow all origins
router.Use(cors.New(cors.Config{
    AllowOrigins: []string{"*"},
}))
```

### JWT Security

```go
// ✅ GOOD: Short-lived tokens with refresh
jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
    "user_id": user.ID,
    "role":    user.Role,
    "exp":     time.Now().Add(15 * time.Minute).Unix(), // 15 min
})

// Store refresh token in httpOnly cookie
c.SetCookie("refresh_token", refreshToken, 86400, "/", "", true, true)

// ❌ BAD: Long-lived tokens in localStorage
jwt.MapClaims{
    "user_id": user.ID,
    "exp":     time.Now().Add(365 * 24 * time.Hour).Unix(), // 1 year!
}
```

---

## Docker Security

### Image Security

```dockerfile
# ✅ GOOD: Use specific versions
FROM golang:1.21-alpine AS builder

# Run as non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser
USER appuser

# ❌ BAD: Use latest tag
FROM golang:latest
```

### Container Runtime

```yaml
# ✅ GOOD: Security constraints
backend:
  security_opt:
    - no-new-privileges:true
  cap_drop:
    - ALL
  cap_add:
    - NET_BIND_SERVICE
  read_only: true
  tmpfs:
    - /tmp

# ❌ BAD: Privileged container
backend:
  privileged: true
```

### Secrets

```yaml
# ✅ GOOD: Docker secrets
services:
  app:
    secrets:
      - db_password
secrets:
  db_password:
    file: ./secrets/db_password.txt

# ❌ BAD: Secrets in environment
services:
  app:
    environment:
      DB_PASSWORD: "my_secret_password"
```

---

## Development Practices

### Pre-Commit Checklist

Before every commit:

- [ ] Run pre-commit hook: `git commit` (automatic)
- [ ] No secrets in code: `git diff --staged | grep -i password`
- [ ] Tests pass: `make test`
- [ ] Linter passes: `make lint`
- [ ] No `console.log` or `fmt.Println` in production code

### Code Review Checklist

When reviewing code:

- [ ] Authentication/authorization checks present
- [ ] Input validation on all user input
- [ ] SQL queries use parameterized statements
- [ ] No hardcoded credentials or secrets
- [ ] Error messages don't expose sensitive info
- [ ] Logging doesn't include sensitive data

### Dependency Management

```bash
# ✅ GOOD: Regular updates and vulnerability scanning
go get -u all
go mod tidy
govulncheck ./...

npm audit fix
npm outdated

# ❌ BAD: Never update dependencies
```

---

## Production Deployment

### Deployment Checklist

Before deploying to production:

- [ ] All secrets rotated (different from dev/staging)
- [ ] SSL/TLS certificates valid
- [ ] Firewall rules configured (minimal ports open)
- [ ] Database backups automated and tested
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers configured
- [ ] Logs being collected and monitored

### Security Headers

```go
// Add security headers
router.Use(func(c *gin.Context) {
    c.Header("X-Frame-Options", "DENY")
    c.Header("X-Content-Type-Options", "nosniff")
    c.Header("X-XSS-Protection", "1; mode=block")
    c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    c.Header("Content-Security-Policy", "default-src 'self'")
    c.Next()
})
```

### Environment Separation

```bash
# ✅ GOOD: Separate environments with different credentials
dev.itms.com      # Development database, test credentials
staging.itms.com  # Staging database, staging credentials
itms.com          # Production database, production credentials

# ❌ BAD: All environments use same database
```

---

## Incident Response

### If Credentials Are Leaked

**Within 15 minutes:**

1. **Rotate compromised credentials immediately**
   ```bash
   ./scripts/rotate-credentials.sh
   ```

2. **Remove from git history**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" --all
   git push --force --all
   ```

3. **Check access logs** for unauthorized access

**Within 1 hour:**

4. Document incident in security log
5. Notify team and stakeholders
6. Review and improve security procedures

**Within 24 hours:**

7. Conduct post-mortem
8. Implement preventive measures
9. Update security training

### Reporting Security Issues

**Internal Team:**
- Create private issue in GitHub (security advisory)
- Tag: `security`, `urgent`
- Notify security lead immediately

**External Researchers:**
- Email: security@your-domain.com
- PGP key available at: /security.txt
- Response within 24 hours

---

## Security Tools

### Required Tools

```bash
# Install pre-commit hook
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Dependency scanning
go install golang.org/x/vuln/cmd/govulncheck@latest
npm install -g npm-audit

# Secret scanning
docker pull trufflesecurity/trufflehog:latest
docker pull zricethezav/gitleaks:latest
```

### Automated Scanning

GitHub Actions runs security scans on every push:

- Secret detection (TruffleHog, Gitleaks)
- Dependency vulnerabilities (Trivy)
- Code security (gosec)
- Docker image scanning

Check: GitHub → Security → Code scanning alerts

---

## Salt API Security

### 🚨 CRITICAL: Network Exposure

**Salt API (port 8000) must NEVER be exposed to the public internet.**

The Salt API provides powerful system administration capabilities and should only be accessible from:
- The ITMS backend server (localhost or private network)
- Trusted administrative jump boxes
- VPN-connected administrators (with strict firewall rules)

### Firewall Configuration

#### Using UFW (Ubuntu/Debian)

```bash
# Allow Salt API only from ITMS backend (localhost)
sudo ufw allow from 127.0.0.1 to any port 8000 proto tcp

# Allow Salt API from specific private network
sudo ufw allow from 10.10.0.0/16 to any port 8000 proto tcp

# Deny all other access to Salt API
sudo ufw deny 8000/tcp
```

#### Using firewalld (RHEL/CentOS)

```bash
# Create rich rule for Salt API (private network only)
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.10.0.0/16" port port="8000" protocol="tcp" accept'

# Block Salt API from public zones
sudo firewall-cmd --zone=public --remove-port=8000/tcp --permanent

# Reload firewall
sudo firewall-cmd --reload
```

#### Using iptables

```bash
# Allow Salt API from localhost
sudo iptables -A INPUT -s 127.0.0.1 -p tcp --dport 8000 -j ACCEPT

# Allow from private network
sudo iptables -A INPUT -s 10.10.0.0/16 -p tcp --dport 8000 -j ACCEPT

# Deny all other access
sudo iptables -A INPUT -p tcp --dport 8000 -j DROP

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

### Salt API Binding Configuration

Configure Salt API to bind only to localhost/private interfaces:

```yaml
# /etc/salt/master.d/api.conf
rest_cherrypy:
  port: 8000
  host: 127.0.0.1  # Localhost only
  # OR for private network:
  # host: YOUR_PRIVATE_IP  # Private IP only
  ssl_crt: /etc/salt/ssl/cert.pem
  ssl_key: /etc/salt/ssl/key.pem
  disable_ssl: false  # Always use SSL
```

### Authentication & Authorization

```yaml
# /etc/salt/master.d/api.conf
external_auth:
  pam:
    itms_service_account:
      - '@wheel'
      - '@runner'
      - 'test.*'
      - 'grains.*'
      - 'cmd.run'
      - 'state.apply'
```

### Access Control

ITMS enforces role-based access control for Salt functions:

| Function | it_team | super_admin | Notes |
|----------|---------|-------------|-------|
| `test.ping`, `grains.items`, `disk.usage` | ✅ | ✅ | Safe read-only |
| `cmd.run` | ✅ | ✅ | Limited commands |
| `state.apply`, `state.sls` | ❌ | ✅ | Dangerous - super_admin only |
| `cmd.script` | ❌ | ✅ | Dangerous - super_admin only |

### Monitoring & Auditing

```bash
# Monitor Salt API access logs
sudo tail -f /var/log/salt/api

# Check active Salt connections
sudo netstat -tnp | grep :8000

# Audit Salt master logs
sudo tail -f /var/log/salt/master
```

### Security Checklist

- [ ] Salt API bound to localhost or private network only
- [ ] Firewall rules configured to block public access
- [ ] SSL/TLS enabled with valid certificates
- [ ] Strong authentication credentials (32+ character passwords)
- [ ] Regular audit of Salt API logs
- [ ] Restricted function access (dangerous commands require super_admin)
- [ ] Network segmentation between Salt API and internet-facing services
- [ ] Regular security updates for Salt and dependencies

### Incident Response

If Salt API is exposed to the internet:

1. **Immediately block public access** via firewall
2. **Rotate all Salt API credentials** (service accounts, auth tokens)
3. **Audit Salt logs** for unauthorized commands
4. **Check all managed nodes** for suspicious activity
5. **Review and update firewall rules**
6. **Document incident** in security log

### References

- [Salt Security Best Practices](https://docs.saltproject.io/en/latest/topics/hardening.html)
- [Salt API Documentation](https://docs.saltproject.io/en/latest/ref/netapi/all/salt.netapi.rest_cherrypy.html)

---

## Training & Resources

### Required Reading

- [ ] [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [ ] [ITMS Secrets Management Guide](./SECRETS_MANAGEMENT.md)
- [ ] This document (review quarterly)

### Recommended Resources

- [Go Security Checklist](https://github.com/Checkmarx/Go-SCP)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

---

## Compliance

### Regular Security Tasks

**Daily:**
- Monitor security alerts (GitHub, Dependabot)
- Review application logs for suspicious activity

**Weekly:**
- Review open security issues
- Update dependencies with security fixes

**Monthly:**
- Scan for vulnerabilities: `make security-scan`
- Review access logs
- Update security documentation

**Quarterly:**
- Rotate all credentials
- Security training for team
- Penetration testing
- Review and update security procedures

---

## Contact

**Security Lead**: [Name]  
**Email**: security@your-domain.com  
**Emergency**: [Phone]

**Report security issues to**: security@your-domain.com

---

## Acknowledgments

Security is everyone's responsibility. Thank you for keeping ITMS secure! 🔒
