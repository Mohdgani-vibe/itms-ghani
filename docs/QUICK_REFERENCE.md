# Quick Reference: Password Reset & Server Deployment

## Password Reset - Super Quick Start

### Via UI (Easiest)
1. Login as super admin → Users page
2. Find user → Click "Reset Password"  
3. Enter new password (12+ chars) → Save

### Via API (Automated)
```bash
# Login
TOKEN=$(curl -X POST http://localhost/api/auth/login \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASS"}' \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# Reset password
curl -X PATCH http://localhost/api/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"initial_password":"NewPassword123456"}'
```

**Password Requirements:** Minimum 12 characters

---

## Second Server Deployment - Super Quick Start

### Generate Deployment Runbook

```bash
cd /home/itteam/itms
mkdir -p .run

# Interactive (recommended - prompts for passwords)
bash scripts/render-second-server-runbook.sh \
  --server-ip 172.10.80.20 \
  --server-name itms2.zero.com \
  --prompt-admin-password \
  --prompt-jwt-secret \
  --output .run/deployment.md
```

### Deploy to New Server

```bash
# Copy runbook to server
scp .run/deployment.md root@172.10.80.20:/root/

# SSH and follow the commands
ssh root@172.10.80.20
less /root/deployment.md
# Execute each section
```

### Verify Deployment

```bash
docker ps | grep itms
curl http://localhost:3001/api/health
bash scripts/smoke-test-itms-api.sh
```

---

## Full Documentation

- **Update Server:** [docs/update-existing-server.md](update-existing-server.md)
- **Password Reset:** [docs/password-reset-guide.md](password-reset-guide.md)
- **Server Deployment:** [docs/second-server-deployment-guide.md](second-server-deployment-guide.md)

---

## Common Tasks

### Update Existing ITMS Server (172.10.80.16)
```bash
# SSH to server
ssh root@172.10.80.16
cd /home/itms/itms

# Pull latest code
git pull origin main

# Update backend
cd backend && docker-compose down && docker-compose up -d --build

# Update frontend
cd ../frontend && npm install && npm run build
sudo rsync -av --delete dist/ /var/www/itms/

# Restart nginx
sudo systemctl restart nginx

# Verify
curl http://localhost:3001/api/health
```

### Reset Employee Password
```bash
# On production server
cd /home/itms/itms

TOKEN=$(curl -X POST http://localhost/api/auth/login \
  -d '{"email":"muhammed.gani@zerodha.com","password":"Zer0dhA@2026"}' \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

curl -X PATCH http://localhost/api/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"initial_password":"NewPassword123456"}' \
  | python3 -m json.tool
```

### Deploy ITMS to Second Server
```bash
# From dev machine
cd /home/itteam/itms

bash scripts/render-second-server-runbook.sh \
  --server-ip 172.10.80.20 \
  --server-name itms2.zero.com \
  --prompt-admin-password \
  --prompt-jwt-secret \
  --output .run/itms2.md

scp .run/itms2.md root@172.10.80.20:/root/
ssh root@172.10.80.20 'bash /root/itms2.md'
```

### Sync Admin Password (After .env Change)
```bash
cd /home/itms/itms/backend
source .env && source .env.secrets
go run ./cmd/sync_default_admin_password
```

---

## Emergency Contacts

- **IT Team Lead:** muhammed.gani@zerodha.com
- **System Admin:** [Your Contact]
- **Support Channel:** [Mattermost/Slack Channel]

---

## Troubleshooting Quick Fixes

### Can't Login
```bash
# Verify credentials
curl -X POST http://localhost/api/auth/login \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASS"}' | python3 -m json.tool
```

### Backend Down
```bash
docker logs zerodha-itms-backend --tail 50
cd /home/itms/itms/backend && docker-compose restart backend
```

### Frontend Blank Page
```bash
cd /home/itms/itms/frontend
npm run build
sudo rsync -av --delete dist/ /var/www/itms/
sudo systemctl restart nginx
```

---

Last Updated: 2026-06-16
