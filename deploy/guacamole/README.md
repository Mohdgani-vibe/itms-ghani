# Apache Guacamole - Remote Desktop Gateway

## Overview

Apache Guacamole provides clientless remote desktop access via browser. It supports RDP (Windows), VNC (GUI Linux/Windows), and SSH protocols.

## Quick Start

### 1. Generate Database Schema

```bash
cd /home/itms/itms/itms-ghani

# Generate PostgreSQL init script
docker run --rm guacamole/guacamole:1.5.4 /opt/guacamole/bin/initdb.sh --postgres > deploy/guacamole/init/001-init-db.sql
```

### 2. Configure Environment

Create `.env` file or set environment variable:

```bash
export GUACAMOLE_DB_PASSWORD="your_secure_password_here"
```

### 3. Start Services

```bash
docker-compose -f deploy/guacamole/docker-compose.yml up -d
```

### 4. Verify Installation

```bash
# Check container status
docker-compose -f deploy/guacamole/docker-compose.yml ps

# View logs
docker-compose -f deploy/guacamole/docker-compose.yml logs -f guacamole

# Test web interface
curl http://localhost:8080/guacamole/
```

### 5. Initial Login

1. Open: `http://YOUR_SERVER_IP:8080/guacamole`
2. Login with default credentials:
   - Username: `guacadmin`
   - Password: `guacadmin`
3. **IMMEDIATELY** change the password:
   - Click username (top-right) → Settings → Preferences → Change Password

## ITMS Integration

### Nginx Configuration

Add to `deploy/nginx/itms.conf`:

```nginx
# Guacamole remote desktop proxy
location /remote/ {
    proxy_pass http://localhost:8080/guacamole/;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_cookie_path /guacamole/ /remote/;
    access_log /var/log/nginx/guacamole.access.log;
    error_log /var/log/nginx/guacamole.error.log;
}
```

Reload nginx:
```bash
sudo systemctl reload nginx
```

### Backend Integration

Create `backend/services/guacamole.go` to:
- Authenticate with Guacamole API
- Create connections dynamically per device
- Generate connection tokens for frontend

Example API call:
```go
// Create RDP connection for Windows device
POST http://guacamole:8080/guacamole/api/session/data/postgresql/connections
Authorization: Bearer <guac_token>
{
  "name": "DEVICE-HOSTNAME",
  "protocol": "rdp",
  "parameters": {
    "hostname": "10.10.21.123",
    "port": "3389",
    "username": "administrator",
    "password": "<from_vault>",
    "ignore-cert": "true"
  }
}
```

### Frontend Integration

In `DeviceDetailPage.tsx`, add "Remote Desktop" button next to SSH terminal:

```tsx
{canOperate && device.osName?.toLowerCase().includes('windows') && (
  <button
    onClick={() => handleRemoteDesktop(device.id)}
    className="btn btn-primary"
  >
    <Monitor className="mr-2 h-4 w-4" />
    Remote Desktop
  </button>
)}
```

Opens iframe or new tab:
```
https://itms.example.com/remote/#/client/{connection_id}?token={auth_token}
```

## Connection Types

### RDP (Windows)
- Protocol: `rdp`
- Port: `3389`
- Best for: Windows desktops/servers
- Features: Full GUI, clipboard, file transfer

### VNC (Linux/Windows)
- Protocol: `vnc`
- Port: `5900`
- Best for: Linux GUI, legacy systems
- Features: Screen sharing, basic control

### SSH (Terminal)
- Protocol: `ssh`
- Port: `22`
- Best for: Linux servers
- Note: ITMS already has SSH terminal, use for GUI fallback

## Security Hardening

### 1. Change Default Password
```sql
-- Connect to guacamole_db
docker exec -it itms-guacamole-postgres psql -U guacamole_user -d guacamole_db

-- Verify default admin exists
SELECT * FROM guacamole_entity WHERE name = 'guacadmin';

-- Change password via web UI (Settings → Preferences)
```

### 2. Enable MFA (TOTP)
1. Admin → Users → guacadmin → Edit
2. Enable "TOTP Authentication"
3. Scan QR code with authenticator app

### 3. Restrict Network Access
```bash
# Firewall: Allow only from ITMS server
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.10.21.11" port port="8080" protocol="tcp" accept'
sudo firewall-cmd --reload
```

### 4. Enable Session Recording
Already configured in docker-compose.yml:
- Recordings stored in `/record` volume
- Access via: `docker exec itms-guacamole ls /record`
- Playback via Guacamole web UI

### 5. SSL/TLS
Nginx handles SSL termination. Ensure HTTPS is enforced:
```nginx
# In itms.conf
if ($scheme != "https") {
    return 301 https://$host$request_uri;
}
```

## Troubleshooting

### Guacamole not starting
```bash
# Check logs
docker-compose -f deploy/guacamole/docker-compose.yml logs guacamole

# Common issues:
# - Database not initialized: Run initdb.sh first
# - guacd not ready: Wait for healthcheck to pass
# - Port 8080 in use: Change in docker-compose.yml
```

### Connection failed
```bash
# Test from guacamole container
docker exec -it itms-guacamole curl http://guacd:4822

# Test RDP connection manually
docker exec -it itms-guacd nc -zv 10.10.21.123 3389
```

### Database connection error
```bash
# Verify postgres is running
docker exec -it itms-guacamole-postgres pg_isready

# Check credentials
docker exec -it itms-guacamole-postgres psql -U guacamole_user -d guacamole_db -c "SELECT version();"
```

## Backup & Recovery

### Backup Database
```bash
docker exec itms-guacamole-postgres pg_dump -U guacamole_user guacamole_db > guacamole-backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
cat guacamole-backup-20260627.sql | docker exec -i itms-guacamole-postgres psql -U guacamole_user -d guacamole_db
```

## Management Commands

```bash
# Start
docker-compose -f deploy/guacamole/docker-compose.yml up -d

# Stop
docker-compose -f deploy/guacamole/docker-compose.yml stop

# Restart
docker-compose -f deploy/guacamole/docker-compose.yml restart guacamole

# View logs
docker-compose -f deploy/guacamole/docker-compose.yml logs -f

# Remove (data persists in volumes)
docker-compose -f deploy/guacamole/docker-compose.yml down
```

## API Documentation

- Base URL: `http://localhost:8080/guacamole/api`
- Auth: `POST /api/tokens` (get auth token)
- Connections: `/api/session/data/postgresql/connections`
- Users: `/api/session/data/postgresql/users`
- Sessions: `/api/session/data/postgresql/activeConnections`

Full API docs: https://guacamole.apache.org/doc/gug/guacamole-rest-api.html

## License

Apache Guacamole is licensed under Apache License 2.0.
Free and open-source for commercial use.
