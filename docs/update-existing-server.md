# Update Existing ITMS Server

Guide for updating an existing ITMS installation (e.g., server 172.10.80.16).

## Table of Contents

- [Quick Update (Recommended)](#quick-update-recommended)
- [Step-by-Step Update](#step-by-step-update)
- [Update Components](#update-components)
- [Rollback Procedure](#rollback-procedure)
- [Troubleshooting](#troubleshooting)

---

## Quick Update (Recommended)

For updating an existing ITMS server with the latest code changes.

### Prerequisites

- SSH access to the server
- Existing ITMS installation at `/home/itms/itms`
- Docker and Docker Compose installed
- Nginx configured and running

### Quick Update Commands

```bash
# SSH to the server
ssh root@172.10.80.16

# Navigate to ITMS directory
cd /home/itms/itms

# Pull latest code
git fetch origin
git pull origin main

# Update backend
cd backend
docker-compose down
docker-compose up -d --build

# Wait for backend to be healthy (check logs)
docker logs -f zerodha-itms-backend

# Update frontend
cd ../frontend
npm install
npm run build

# Deploy frontend to nginx
sudo rsync -av --delete dist/ /var/www/itms/

# Restart nginx
sudo systemctl restart nginx

# Verify update
curl http://localhost:3001/api/health
curl http://localhost/api/health
curl -I http://localhost/
```

Expected result: All commands should return success, backend shows healthy status.

---

## Step-by-Step Update

Detailed update procedure with verification at each step.

### Step 1: Backup Current Installation

Before updating, create a backup:

```bash
# SSH to server
ssh root@172.10.80.16

cd /home/itms

# Backup database
docker exec zerodha-itms-postgres pg_dump -U postgres itms > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup configuration
cp -r itms/backend/.env itms/backend/.env.backup.$(date +%Y%m%d)
cp -r itms/backend/.env.secrets itms/backend/.env.secrets.backup.$(date +%Y%m%d)

echo "✅ Backup complete"
```

### Step 2: Update Code from Repository

```bash
cd /home/itms/itms

# Check current branch and status
git status
git branch

# Pull latest changes
git fetch origin
git pull origin main

# If you get merge conflicts
# Option 1: Stash local changes
git stash
git pull origin main
git stash pop

# Option 2: Reset to remote (WARNING: discards local changes)
# git reset --hard origin/main

echo "✅ Code updated"
```

### Step 3: Update Backend

```bash
cd /home/itms/itms/backend

# Check current environment configuration
cat .env | grep -E "PUBLIC_SERVER_URL|DEFAULT_ADMIN_EMAIL|FRONTEND_ORIGIN"

# Stop backend
docker-compose down

# Rebuild and start backend
docker-compose up -d --build

# Wait for backend to start (30 seconds)
sleep 30

# Check backend status
docker ps | grep itms
docker logs zerodha-itms-backend --tail 50

# Verify backend health
curl http://localhost:3001/api/health

echo "✅ Backend updated"
```

### Step 4: Update Frontend

```bash
cd /home/itms/itms/frontend

# Install/update dependencies
npm install

# Build production assets
npm run build

# Verify build completed
ls -lh dist/

# Deploy to nginx
sudo rsync -av --delete dist/ /var/www/itms/

# Verify deployment
ls -lh /var/www/itms/

echo "✅ Frontend updated"
```

### Step 5: Restart Nginx

```bash
# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx

# Verify nginx is serving
curl -I http://localhost/

echo "✅ Nginx restarted"
```

### Step 6: Verify Update

```bash
# Test backend directly
curl http://localhost:3001/api/health

# Test backend through nginx
curl http://localhost/api/health

# Test frontend
curl -I http://localhost/

# Test login (replace password)
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"muhammed.gani@zerodha.com","password":"Zer0dhA@2026"}' \
  | python3 -m json.tool

# Check Docker containers
docker ps | grep itms

echo "✅ Update verification complete"
```

### Step 7: Test in Browser

Open browser and test:

1. Navigate to: `http://172.10.80.16/`
2. Login with admin credentials
3. Test key features:
   - Dashboard loads
   - Users page works
   - Devices page works
   - Inventory page works
4. **Important:** If you see cached old version, hard refresh: `Ctrl + Shift + R`

---

## Update Components

### Update Backend Only

If only backend code changed:

```bash
cd /home/itms/itms
git pull origin main

cd backend
docker-compose down
docker-compose up -d --build

# Verify
curl http://localhost:3001/api/health
```

### Update Frontend Only

If only frontend code changed:

```bash
cd /home/itms/itms
git pull origin main

cd frontend
npm install
npm run build
sudo rsync -av --delete dist/ /var/www/itms/
sudo systemctl restart nginx

# Verify
curl -I http://localhost/
```

### Update Database Schema (Migrations)

If database schema changed:

```bash
cd /home/itms/itms/backend

# Backup database first!
docker exec zerodha-itms-postgres pg_dump -U postgres itms > backup_before_migration.sql

# Restart backend (migrations run automatically on startup)
docker-compose down
docker-compose up -d

# Check logs for migration status
docker logs zerodha-itms-backend | grep -i migration
```

### Update Environment Variables

If configuration changed:

```bash
cd /home/itms/itms/backend

# Edit configuration
nano .env
# or
nano .env.secrets

# Restart backend to apply changes
docker-compose down
docker-compose up -d

# Verify
curl http://localhost:3001/api/health
```

### Update Nginx Configuration

If nginx config changed:

```bash
# If scripts/install-itms-nginx.sh was updated
cd /home/itms/itms
sudo bash scripts/install-itms-nginx.sh 172.10.80.16

# Or manually edit
sudo nano /etc/nginx/sites-available/itms

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Rollback Procedure

If update causes issues, rollback to previous version:

### Rollback Backend

```bash
cd /home/itms/itms/backend

# Stop current version
docker-compose down

# Restore previous code
git log --oneline -10  # Find previous commit
git checkout PREVIOUS_COMMIT_HASH

# Or go back one commit
git reset --hard HEAD~1

# Restore configuration if needed
cp .env.backup.YYYYMMDD .env
cp .env.secrets.backup.YYYYMMDD .env.secrets

# Start previous version
docker-compose up -d

# Verify
curl http://localhost:3001/api/health
```

### Rollback Database

```bash
# List available backups
ls -lh /home/itms/backup_*.sql

# Restore from backup
docker exec -i zerodha-itms-postgres psql -U postgres -d itms < /home/itms/backup_20260616_120000.sql

# Restart backend
cd /home/itms/itms/backend
docker-compose restart backend
```

### Rollback Frontend

```bash
cd /home/itms/itms

# Go back to previous commit
git checkout PREVIOUS_COMMIT_HASH

# Rebuild frontend
cd frontend
npm install
npm run build
sudo rsync -av --delete dist/ /var/www/itms/
sudo systemctl restart nginx
```

---

## Troubleshooting

### Update Failed - Backend Won't Start

**Check logs:**
```bash
docker logs zerodha-itms-backend --tail 100
```

**Common issues:**
1. Port 3001 already in use
2. Database connection failed
3. Migration failed
4. Missing environment variables

**Solution:**
```bash
# Check if old container is still running
docker ps -a | grep backend

# Remove old containers
docker rm -f zerodha-itms-backend

# Restart
cd /home/itms/itms/backend
docker-compose up -d

# If migration failed, check database
docker exec -it zerodha-itms-postgres psql -U postgres -c "\d" itms
```

### Frontend Shows Old Version

**Solution:**
```bash
# Clear browser cache
# Press Ctrl + Shift + R (hard refresh)
# Or use incognito mode: Ctrl + Shift + N

# Verify files were deployed
ls -lh /var/www/itms/assets/

# Check nginx is serving new files
curl -I http://localhost/assets/index-*.js
```

### Git Pull Failed - Conflicts

**Solution:**
```bash
cd /home/itms/itms

# Option 1: Stash your changes
git stash
git pull origin main
git stash pop  # Apply your changes back

# Option 2: Discard local changes (CAREFUL!)
git reset --hard origin/main
git pull origin main
```

### Database Connection Failed

**Check PostgreSQL:**
```bash
docker ps | grep postgres
docker logs zerodha-itms-postgres --tail 50

# Restart database
cd /home/itms/itms/backend
docker-compose restart postgres

# Wait 10 seconds
sleep 10

# Restart backend
docker-compose restart backend
```

### Nginx Shows 502 Bad Gateway

**Cause:** Backend is not running or not accessible

**Solution:**
```bash
# Check backend is running
docker ps | grep backend
curl http://localhost:3001/api/health

# If backend is down, restart it
cd /home/itms/itms/backend
docker-compose up -d

# Check nginx proxy configuration
sudo cat /etc/nginx/sites-available/itms | grep proxy_pass

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## Update Checklist

Use this checklist for updates:

- [ ] Backup database
- [ ] Backup configuration files (.env, .env.secrets)
- [ ] Pull latest code from git
- [ ] Update backend (rebuild and restart)
- [ ] Update frontend (rebuild and redeploy)
- [ ] Restart nginx
- [ ] Verify backend health endpoint
- [ ] Verify frontend loads in browser
- [ ] Test login functionality
- [ ] Test key features (users, devices, inventory)
- [ ] Check for errors in logs
- [ ] Clear browser cache if needed (Ctrl+Shift+R)

---

## Automated Update Script

Create a script for quick updates:

```bash
cat > /home/itms/update-itms.sh <<'EOF'
#!/bin/bash
set -e

echo "🔄 Starting ITMS update..."

# Backup
echo "📦 Creating backup..."
cd /home/itms
docker exec zerodha-itms-postgres pg_dump -U postgres itms > backup_$(date +%Y%m%d_%H%M%S).sql

# Update code
echo "📥 Pulling latest code..."
cd /home/itms/itms
git pull origin main

# Update backend
echo "🔧 Updating backend..."
cd backend
docker-compose down
docker-compose up -d --build
sleep 30

# Update frontend
echo "🎨 Updating frontend..."
cd ../frontend
npm install
npm run build
sudo rsync -av --delete dist/ /var/www/itms/

# Restart nginx
echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

# Verify
echo "✅ Verifying update..."
curl -f http://localhost:3001/api/health || { echo "❌ Backend health check failed"; exit 1; }
curl -f http://localhost/api/health || { echo "❌ Nginx health check failed"; exit 1; }

echo "✅ Update complete!"
echo "🌐 Access: http://172.10.80.16/"
echo "⚠️  Clear browser cache if you see old version (Ctrl+Shift+R)"
EOF

chmod +x /home/itms/update-itms.sh
```

Run the script:
```bash
bash /home/itms/update-itms.sh
```

---

## Security Notes

1. **Always backup before updating**
2. **Test updates in development environment first**
3. **Update during low-traffic periods**
4. **Keep backup files for at least 7 days**
5. **Monitor logs after update**
6. **Verify all features work after update**

---

## Quick Reference

### Full Update
```bash
ssh root@172.10.80.16
cd /home/itms/itms
git pull origin main
cd backend && docker-compose down && docker-compose up -d --build
cd ../frontend && npm install && npm run build
sudo rsync -av --delete dist/ /var/www/itms/ && sudo systemctl restart nginx
```

### Verify Update
```bash
curl http://localhost:3001/api/health
curl http://localhost/api/health
docker ps | grep itms
```

### Rollback
```bash
cd /home/itms/itms
git reset --hard HEAD~1
cd backend && docker-compose down && docker-compose up -d
```

---

## Related Documentation

- [Installation Guide](../INSTALLATION.md)
- [Second Server Deployment](second-server-deployment-guide.md)
- [Password Reset Guide](password-reset-guide.md)
- [Troubleshooting Guide](troubleshooting.md)

---

**Last Updated:** 2026-06-16  
**Server:** 172.10.80.16 (itms.zero.com)
