# Quick Deployment Guide - Maximum Security Hardening

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)
```bash
# Full deployment with backup
sudo scripts/deploy-security-hardening.sh

# Dry run first (see what will happen)
sudo scripts/deploy-security-hardening.sh --dry-run

# Deploy without backup (not recommended)
sudo scripts/deploy-security-hardening.sh --no-backup
```

### Option 2: Manual Deployment

#### Step 1: Deploy nginx Configuration
```bash
# Backup current config
sudo cp /etc/nginx/sites-available/itms.conf /etc/nginx/sites-available/itms.conf.backup

# Copy new configuration
sudo cp deploy/nginx/itms.conf /etc/nginx/sites-available/itms.conf

# Configure placeholders (replace these values)
sudo sed -i 's/__SERVER_NAME__/your-domain.com/g' /etc/nginx/sites-available/itms.conf
sudo sed -i 's/__WWW_ROOT__/\/var\/www\/itms/g' /etc/nginx/sites-available/itms.conf
sudo sed -i 's/__BACKEND_UPSTREAM__/localhost:3001/g' /etc/nginx/sites-available/itms.conf

# Test configuration
sudo nginx -t

# Reload (zero downtime)
sudo systemctl reload nginx
```

#### Step 2: Deploy Backend
```bash
# Pull latest code
cd /opt/itms
git pull origin main

# Rebuild and restart backend
docker-compose build backend
docker-compose up -d --no-deps backend

# Check logs
docker-compose logs -f backend
```

#### Step 3: Verify Deployment
```bash
# Check nginx status
sudo systemctl status nginx

# Check backend container
docker ps | grep backend

# Test rate limiting (should block after 5 attempts)
for i in {1..10}; do
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  sleep 5
done
```

---

## 📊 Monitoring

### Start Security Monitoring Dashboard
```bash
# One-time check
sudo scripts/security-monitor.sh

# Watch mode (updates every 30 seconds)
sudo scripts/security-monitor.sh --watch

# Custom lookback period
sudo scripts/security-monitor.sh --hours=48
```

### Manual Log Checking
```bash
# nginx rate limiting events
sudo tail -f /var/log/nginx/error.log | grep limit_req

# Backend logs
docker-compose logs -f backend

# Database audit log (suspicious patterns)
psql -h localhost -U postgres -d itms -c \
  "SELECT * FROM audit_log WHERE action LIKE 'suspicious_pattern_%' ORDER BY created_at DESC LIMIT 10;"
```

---

## 🔧 Configuration Tuning

### Adjust Rate Limits (if needed)

Edit `/etc/nginx/sites-available/itms.conf`:

```nginx
# Stricter limits (for high-security environments)
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=3r/m;  # 3 req/min
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/m;  # 20 req/min

# More lenient limits (for high-traffic environments)
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m; # 10 req/min
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;  # 60 req/min
```

After changes:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Adjust Auth Attempt Limits

Edit `backend/internal/api/router.go` line ~812:

```go
// Current: 5 attempts in 10min, 30min block
authLimiter: newAuthAttemptLimiter(10*time.Minute, 5, 30*time.Minute)

// Stricter: 3 attempts in 5min, 60min block
authLimiter: newAuthAttemptLimiter(5*time.Minute, 3, 60*time.Minute)

// More lenient: 10 attempts in 15min, 15min block
authLimiter: newAuthAttemptLimiter(15*time.Minute, 10, 15*time.Minute)
```

After changes:
```bash
cd /opt/itms
docker-compose build backend
docker-compose up -d --no-deps backend
```

---

## 🔄 Rollback Procedure

### Automatic Rollback
```bash
# Use automated script
sudo scripts/deploy-security-hardening.sh --rollback

# Follow prompts to select backup
```

### Manual Rollback

#### Rollback nginx
```bash
# Restore from backup
sudo cp /etc/nginx/sites-available/itms.conf.backup /etc/nginx/sites-available/itms.conf

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

#### Rollback Backend
```bash
cd /opt/itms

# Revert git commit
git revert cd53c32  # Maximum security hardening commit

# Rebuild and restart
docker-compose build backend
docker-compose up -d --no-deps backend
```

---

## 🧪 Testing Commands

### Test Rate Limiting
```bash
# Auth endpoints (should block after 5 requests)
for i in {1..8}; do
  echo "Request $i:"
  curl -s -w "\nHTTP Status: %{http_code}\n" \
    -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "---"
  sleep 10
done
```

### Test Request Size Limit
```bash
# Should succeed (9MB)
dd if=/dev/zero bs=1M count=9 | \
  curl -X POST https://your-domain.com/api/test \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @-

# Should fail with 413 (11MB)
dd if=/dev/zero bs=1M count=11 | \
  curl -X POST https://your-domain.com/api/test \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @-
```

### Test Suspicious Pattern Detection
```bash
# XSS pattern (should return 400)
curl "https://your-domain.com/api/users?search=<script>alert(1)</script>"

# SQL injection (should return 400)
curl "https://your-domain.com/api/users?search=' or '1'='1"

# Path traversal (should return 400)
curl "https://your-domain.com/api/files?path=../../../../etc/passwd"
```

### Test CORS
```bash
# Valid origin (should succeed)
curl -H "Origin: https://your-frontend-domain.com" \
     https://your-domain.com/api/health

# Invalid origin (should return 403)
curl -H "Origin: https://malicious-site.com" \
     https://your-domain.com/api/health
```

---

## 🚨 Troubleshooting

### Issue: Rate Limiting Not Working

**Check nginx configuration loaded:**
```bash
sudo nginx -T | grep limit_req_zone
```

**Expected output:**
```
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/m;
```

**If missing:**
```bash
sudo nginx -t  # Check for syntax errors
sudo systemctl reload nginx
```

### Issue: Backend Not Starting

**Check logs:**
```bash
docker-compose logs backend
```

**Common errors:**
- **Port conflict**: Another service using port 3001
- **Database connection**: Check PostgreSQL is running
- **Missing environment variables**: Check `.env` file

**Fix:**
```bash
# Check port
sudo netstat -tlnp | grep 3001

# Check database
docker-compose ps postgres

# Restart everything
docker-compose down
docker-compose up -d
```

### Issue: 502 Bad Gateway

**Cause**: nginx can't reach backend

**Check backend is running:**
```bash
docker-compose ps backend
curl http://localhost:3001/api/health
```

**Check nginx upstream configuration:**
```bash
sudo nginx -T | grep proxy_pass
```

**Fix:**
```bash
# Restart backend
docker-compose restart backend

# Reload nginx
sudo systemctl reload nginx
```

### Issue: Legitimate Users Getting Rate Limited

**Temporary fix (increase limits):**

Edit `/etc/nginx/sites-available/itms.conf`:
```nginx
# Increase burst value
limit_req zone=auth_limit burst=10 nodelay;  # Was: burst=3
```

**Reload:**
```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Permanent fix**: Adjust rate limiting zones (see Configuration Tuning above)

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Backup current nginx configuration
- [ ] Backup current backend binary/code
- [ ] Test in staging environment (if available)
- [ ] Review rate limiting thresholds for your traffic
- [ ] Notify team about deployment
- [ ] Schedule maintenance window (minimal downtime expected)

### Deployment
- [ ] Deploy nginx configuration
- [ ] Test nginx configuration (`nginx -t`)
- [ ] Reload nginx (`systemctl reload nginx`)
- [ ] Pull latest backend code
- [ ] Rebuild backend container
- [ ] Restart backend (`docker-compose up -d --no-deps backend`)
- [ ] Wait 30 seconds for startup

### Post-Deployment
- [ ] Verify nginx is running (`systemctl status nginx`)
- [ ] Verify backend is running (`docker-compose ps backend`)
- [ ] Test rate limiting (try 6+ login attempts)
- [ ] Test request size limits (try 11MB upload)
- [ ] Test suspicious pattern detection (try XSS payload)
- [ ] Check logs for errors (`tail -f /var/log/nginx/error.log`)
- [ ] Monitor for 1 hour using `scripts/security-monitor.sh --watch`
- [ ] Update team on deployment status

### Monitoring (First 24 Hours)
- [ ] Check rate limiting events hourly
- [ ] Monitor auth lockouts
- [ ] Watch for suspicious pattern detections
- [ ] Review CORS violations
- [ ] Check application performance (response times)
- [ ] Monitor server resources (CPU, memory)

---

## 📞 Support

### Documentation
- **Full Security Documentation**: [MAXIMUM_SECURITY_HARDENING.md](MAXIMUM_SECURITY_HARDENING.md)
- **Security Improvements**: [SECURITY_IMPROVEMENTS.md](SECURITY_IMPROVEMENTS.md)
- **Installation Guide**: [INSTALLATION.md](INSTALLATION.md)

### Logs Location
- **nginx errors**: `/var/log/nginx/error.log`
- **nginx access**: `/var/log/nginx/access.log`
- **Backend**: `docker-compose logs backend`
- **Database audit**: PostgreSQL `audit_log` table

### Emergency Contacts
- **Rollback Script**: `sudo scripts/deploy-security-hardening.sh --rollback`
- **Stop Rate Limiting**: Comment out `limit_req` lines in nginx config

---

## 🎯 Success Criteria

Deployment is successful when:
- ✅ nginx reloads without errors
- ✅ Backend container starts and stays running
- ✅ Rate limiting blocks after threshold (5 attempts for auth)
- ✅ Security headers present in responses
- ✅ Suspicious patterns detected and blocked
- ✅ No increase in application errors
- ✅ Response times remain acceptable (< +10ms avg)
- ✅ All services accessible and functional

---

**Last Updated**: 2026-06-27  
**Deployment Script Version**: 1.0.0  
**Tested On**: Ubuntu 22.04, nginx 1.22+, Docker 24+
