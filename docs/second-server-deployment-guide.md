# Second Server Deployment Guide

Complete guide for deploying ITMS on a second (or additional) server.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Method 1: Interactive Deployment (Recommended)](#method-1-interactive-deployment-recommended)
- [Method 2: Automated Deployment](#method-2-automated-deployment)
- [Method 3: Manual Deployment](#method-3-manual-deployment)
- [Post-Deployment Tasks](#post-deployment-tasks)
- [Multi-Server Architecture](#multi-server-architecture)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide helps you deploy ITMS on additional servers beyond the first installation. Use cases:

- **Load balancing:** Multiple ITMS instances behind a load balancer
- **High availability:** Active-passive or active-active setup
- **Regional deployment:** ITMS instances in different data centers
- **Testing/Staging:** Separate server for testing before production

### What You'll Deploy

- **Backend:** Go API server (port 3001)
- **Frontend:** React app served via nginx (port 80/443)
- **Database:** PostgreSQL 16 (port 5432)
- **Optional:** SaltStack, Wazuh, OpenSCAP integrations

---

## Prerequisites

### Server Requirements

- **Operating System:** Ubuntu 20.04 LTS or newer
- **RAM:** Minimum 4GB, recommended 8GB+
- **Disk Space:** Minimum 20GB available
- **Network:** Server must be accessible from your location

### Required Information

Before starting, prepare these values:

```bash
SERVER_IP="172.10.80.20"              # New server IP address
SERVER_NAME="itms2.zero.com"          # Server hostname/domain
ADMIN_EMAIL="admin@zerodha.com"       # Admin account email
ADMIN_PASSWORD="Strong#Password2026"  # Admin password (12+ chars)
JWT_SECRET="<32+ character secret>"   # JWT signing key
```

### SSH Access

Ensure you can SSH to the new server:

```bash
ssh root@172.10.80.20
# or
ssh user@172.10.80.20
```

---

## Method 1: Interactive Deployment (Recommended)

This method prompts you for credentials interactively (passwords not stored in shell history).

### Step 1: Generate Deployment Runbook

On your **development machine** (where you have the ITMS repository):

```bash
cd /home/itteam/itms

# Create output directory for rendered runbook
mkdir -p .run

# Generate the runbook (will prompt for passwords)
bash scripts/render-second-server-runbook.sh \
  --server-ip 172.10.80.20 \
  --server-name itms2.zero.com \
  --admin-email admin@zerodha.com \
  --prompt-admin-password \
  --prompt-jwt-secret \
  --output .run/itms2-deployment.md
```

You'll be prompted for:
- **Admin password:** Enter a strong password (12+ characters)
- **JWT secret:** Enter a random 32+ character string

### Step 2: Review Generated Runbook

```bash
cat .run/itms2-deployment.md
```

This file contains all commands with **real credentials** filled in. Keep it secure!

### Step 3: Copy to New Server

```bash
# Copy the runbook to new server
scp .run/itms2-deployment.md root@172.10.80.20:/root/itms-deployment.md
```

### Step 4: SSH to New Server and Execute

```bash
# SSH to new server
ssh root@172.10.80.20

# Follow the commands in the deployment runbook
less /root/itms-deployment.md

# Execute each section step by step
# Copy/paste commands from the runbook
```

### Step 5: Verify Deployment

From the new server:

```bash
# Check Docker containers
docker ps | grep itms

# Check backend health
curl http://localhost:3001/api/health

# Check nginx
curl -I http://localhost/

# Run smoke tests
bash scripts/smoke-test-itms-api.sh
bash scripts/smoke-test-itms-nginx.sh --base-url http://172.10.80.20
```

---

## Method 2: Automated Deployment

For CI/CD pipelines or when you want fully automated deployment.

### Step 1: Create Credential Files

On your **development machine**:

```bash
# Create secure directory
mkdir -p ~/.itms-secrets
chmod 700 ~/.itms-secrets

# Store admin password
echo -n "Strong#Password2026" > ~/.itms-secrets/admin-password
chmod 600 ~/.itms-secrets/admin-password

# Store JWT secret (generate random 32+ chars)
python3 -c "import secrets; print(secrets.token_urlsafe(32))" > ~/.itms-secrets/jwt-secret
chmod 600 ~/.itms-secrets/jwt-secret
```

### Step 2: Generate Runbook with Credential Files

```bash
cd /home/itteam/itms

mkdir -p .run

bash scripts/render-second-server-runbook.sh \
  --server-ip 172.10.80.20 \
  --server-name itms2.zero.com \
  --admin-email admin@zerodha.com \
  --admin-password-file ~/.itms-secrets/admin-password \
  --jwt-secret-file ~/.itms-secrets/jwt-secret \
  --output .run/itms2-deployment.md
```

### Step 3: Deploy to Server

```bash
# Copy runbook to server
scp .run/itms2-deployment.md root@172.10.80.20:/root/itms-deployment.md

# SSH and execute
ssh root@172.10.80.20 'bash -s' < /root/itms-deployment.md
```

### Step 4: Verify

```bash
# SSH to server
ssh root@172.10.80.20

# Run verification
bash scripts/verify-itms-stack.sh --sudo
bash scripts/smoke-test-itms-nginx.sh --base-url http://172.10.80.20
```

---

## Method 3: Manual Deployment

Step-by-step manual deployment without using the runbook script.

### Step 1: Install Base Packages

```bash
# SSH to new server
ssh root@172.10.80.20

# Update system
sudo apt-get update
sudo apt-get install -y git nodejs npm curl wget
```

### Step 2: Clone Repository

```bash
cd /home/itteam
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git itms
cd itms
git checkout main
git pull --ff-only origin main
```

### Step 3: Configure Backend

Create `backend/.env`:

```bash
cd /home/itteam/itms/backend

cat > .env <<'EOF'
BACKEND_ADDR=:3001
ITMS_ENFORCE_SECURITY=false
FRONTEND_ORIGIN=http://172.10.80.20,http://localhost:4175,http://127.0.0.1:4175
DATABASE_URL=postgres://postgres:postgres@localhost:5432/itms?sslmode=disable
MIGRATION_DIR=db/postgres_migrations
INVENTORY_SYNC_ENABLED=false
PUBLIC_SERVER_URL=http://172.10.80.20
JWT_SECRET=
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_PASSWORD=
DEFAULT_ADMIN_NAME=ITMS Admin
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URL=http://172.10.80.20/api/auth/google/callback
GOOGLE_HOSTED_DOMAIN=zerodha.com
EOF
```

Create `backend/.env.secrets`:

```bash
cat > .env.secrets <<'EOF'
JWT_SECRET=YourLongRandomJWTSecret32characters+
DEFAULT_ADMIN_PASSWORD=Strong#Password2026
EOF

chmod 600 .env.secrets
```

### Step 4: Install Docker and Start Services

```bash
cd /home/itteam/itms

# Install Docker and start backend
bash scripts/install-docker-and-start-itms.sh --detach
```

### Step 5: Install Nginx and Deploy Frontend

```bash
# Install nginx and deploy frontend
sudo bash scripts/install-itms-nginx.sh 172.10.80.20
```

### Step 6: Verify Installation

```bash
# Check services
docker ps | grep itms

# Test backend
curl http://localhost:3001/api/health

# Test frontend
curl -I http://localhost/

# Test login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"Strong#Password2026"}' \
  | python3 -m json.tool
```

---

## Post-Deployment Tasks

### 1. Update DNS Records

Point your domain to the new server:

```bash
# Example DNS A record
itms2.zero.com.  IN  A  172.10.80.20
```

### 2. Configure SSL/TLS (Optional but Recommended)

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d itms2.zero.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 3. Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 4. Set Up Monitoring

```bash
# Add server monitoring
# - Set up health check endpoint monitoring
# - Configure alerts for downtime
# - Set up log aggregation
```

### 5. Database Backup

```bash
# Configure automated database backups
cd /home/itteam/itms

# Create backup script
cat > scripts/backup-database.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/itteam/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker exec zerodha-itms-postgres pg_dump -U postgres itms > \
  $BACKUP_DIR/itms_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "itms_backup_*.sql" -mtime +7 -delete
EOF

chmod +x scripts/backup-database.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/itteam/itms/scripts/backup-database.sh") | crontab -
```

### 6. Install Server Integrations (Optional)

If you need SaltStack, Wazuh, or OpenSCAP:

```bash
cd /home/itteam/itms

sudo SERVER_HOST=172.10.80.20 bash scripts/install-itms-server-integrations.sh

# Verify integrations
bash scripts/check-itms-server-integrations.sh
```

---

## Multi-Server Architecture

### Load Balanced Setup

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │  (nginx/HAProxy)│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼───┐     ┌────▼───┐    ┌────▼───┐
         │ ITMS-1 │     │ ITMS-2 │    │ ITMS-3 │
         │ Server │     │ Server │    │ Server │
         └────┬───┘     └────┬───┘    └────┬───┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Primary DB)  │
                    └─────────────────┘
```

### Shared Database Configuration

All ITMS instances should connect to the same PostgreSQL database:

**Server 1 (172.10.80.16):**
```bash
DATABASE_URL=postgres://YOUR_DB_USER:YOUR_DB_PASSWORD@db.zero.com:5432/itms
```

**Server 2 (172.10.80.20):**
```bash
DATABASE_URL=postgres://YOUR_DB_USER:YOUR_DB_PASSWORD@db.zero.com:5432/itms
```

### Session Synchronization

All servers must use the **same JWT_SECRET** to maintain session consistency:

```bash
# Both servers must have identical JWT_SECRET
JWT_SECRET=SameSecret32CharactersForAllServers+
```

---

## Troubleshooting

### Issue: 403 Forbidden after deployment

**Solution:** Clear browser cache or use incognito mode

```bash
# Hard refresh: Ctrl + Shift + R
# Or clear cache: Ctrl + Shift + Delete
```

### Issue: Backend not starting

**Check logs:**
```bash
docker logs zerodha-itms-backend
```

**Common causes:**
1. Port 3001 already in use
2. Database connection failure
3. Missing environment variables

**Solution:**
```bash
# Check port
sudo netstat -tlnp | grep 3001

# Restart backend
cd /home/itteam/itms/backend
docker-compose down
docker-compose up -d

# Check database
docker exec -it zerodha-itms-postgres psql -U postgres -c "\l"
```

### Issue: Cannot login with admin credentials

**Solution:** Verify admin password in database matches .env

```bash
cd /home/itteam/itms/backend

# Sync admin password
source .env && source .env.secrets
go run ./cmd/sync_default_admin_password
```

### Issue: Frontend shows blank page

**Check nginx logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**Rebuild frontend:**
```bash
cd /home/itteam/itms/frontend
npm run build
sudo rsync -av --delete dist/ /var/www/itms/
sudo systemctl restart nginx
```

### Issue: Database connection refused

**Check PostgreSQL container:**
```bash
docker ps | grep postgres
docker logs zerodha-itms-postgres
```

**Restart database:**
```bash
cd /home/itteam/itms/backend
docker-compose restart postgres
```

---

## Security Checklist

- [ ] Strong admin password set (12+ characters)
- [ ] JWT secret is random and 32+ characters
- [ ] `.env.secrets` file has proper permissions (chmod 600)
- [ ] Firewall configured (ufw enabled)
- [ ] SSL/TLS certificates installed
- [ ] Database backups scheduled
- [ ] Only necessary ports exposed
- [ ] Server access limited to authorized users

---

## Quick Reference

### Generate Deployment Runbook (Interactive)
```bash
bash scripts/render-second-server-runbook.sh \
  --server-ip 172.10.80.20 \
  --server-name itms2.zero.com \
  --prompt-admin-password \
  --prompt-jwt-secret \
  --output .run/deployment.md
```

### Verify Deployment
```bash
bash scripts/verify-itms-stack.sh --sudo
bash scripts/smoke-test-itms-nginx.sh --base-url http://SERVER_IP
bash scripts/smoke-test-itms-api.sh
```

### Check Services
```bash
docker ps | grep itms
curl http://localhost:3001/api/health
curl -I http://localhost/
```

---

## Related Documentation

- [Installation Guide](../INSTALLATION.md)
- [Multi-Server Load Balancing](multi-server-load-balancing.md)
- [Database Replication](database-replication.md)
- [Backup and Recovery](backup-recovery.md)
