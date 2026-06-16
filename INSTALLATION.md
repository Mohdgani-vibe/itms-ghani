# ITMS Installation Guide

This guide covers the installation and setup of the IT Management System (ITMS) for Zerodha.

## Choose Your Installation Method

Select the installation method that best fits your needs:

| Method | Best For | Time Required | Complexity |
|--------|----------|---------------|------------|
| **[Quick Start](#quick-start---step-by-step)** | Production deployment on fresh Ubuntu server | 15-20 min | ⭐ Easy |
| **[Alternative Quick Dev](#alternative-development-installation-step-by-step)** | Quick development setup | 10-15 min | ⭐⭐ Medium |
| **[Development Installation](#development-installation)** | Detailed dev environment with full control | 20-30 min | ⭐⭐ Medium |
| **[Production with Nginx](#production-deployment-with-nginx)** | Manual production deployment with nginx | 25-35 min | ⭐⭐⭐ Advanced |

**Recommended for most users:** Start with [Quick Start](#quick-start---step-by-step) for production or [Alternative Quick Dev](#alternative-development-installation-step-by-step) for development.

---

## System Architecture Overview

After installation, you'll have:

```
┌─────────────────────────────────────────────────────────┐
│                    ITMS Server                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │   Nginx      │      │   Frontend   │               │
│  │   (Port 80)  │──────│   (React)    │               │
│  └──────────────┘      └──────────────┘               │
│         │                                               │
│         │ /api/*                                        │
│         ↓                                               │
│  ┌──────────────┐      ┌──────────────┐               │
│  │   Backend    │──────│  PostgreSQL  │               │
│  │   (Go:3001)  │      │  (Port 5432) │               │
│  └──────────────┘      └──────────────┘               │
│         │                                               │
│         │ Integrations                                  │
│         ↓                                               │
│  ┌──────────────┬──────────────┬──────────────┐       │
│  │  SaltStack   │    Wazuh     │   OpenSCAP   │       │
│  │  (Port 8000) │ (Port 55000) │   Scanner    │       │
│  └──────────────┴──────────────┴──────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                     ↑
                     │ HTTPS/API
                     │
          ┌──────────┴──────────┐
          │                     │
    ┌──────────┐          ┌──────────┐
    │  Linux   │          │ Windows  │
    │  Agents  │          │  Agents  │
    └──────────┘          └──────────┘
```

**Components:**
- **Nginx**: Web server and reverse proxy (port 80/443)
- **Frontend**: React + TypeScript + Vite UI
- **Backend**: Go + Gin REST API (port 3001)
- **PostgreSQL**: Database (port 5432)
- **SaltStack**: Configuration management (port 8000)
- **Wazuh**: Security monitoring (port 55000)
- **OpenSCAP**: Compliance scanning
- **Agents**: Client-side inventory collectors (Linux/Windows)

---

## Table of Contents

- [Quick Copy-Paste Installation](#quick-copy-paste-installation)
- [Quick Start - Step by Step](#quick-start---step-by-step)
- [Update Existing Installation](#update-existing-installation)
- [Prerequisites](#prerequisites)
- [Quick Production Installation](#quick-production-installation)
- [Development Installation](#development-installation)
- [Production Deployment with Nginx](#production-deployment-with-nginx)
- [Configuration](#configuration)
- [Additional Components](#additional-components)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Quick Copy-Paste Installation

**For experienced administrators:** Copy and paste these commands for a fast installation on Ubuntu 20.04+. Replace values in `<brackets>` with your actual settings.

```bash
# Step 1: System preparation
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget docker.io docker-compose-plugin

# Step 2: Clone repository
sudo mkdir -p /home/itms && sudo chown $USER:$USER /home/itms
cd /home/itms
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git itms
cd itms

# Step 3: Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Step 4: Configure backend
cd backend
cp .env.example .env

# Edit .env with your values (or use sed commands below)
cat > .env << 'EOF'
DATABASE_URL=postgresql://itms_user:itms_pass@postgres:5432/itms
JWT_SECRET=<YOUR_32_CHAR_JWT_SECRET>
PUBLIC_SERVER_URL=http://<YOUR_SERVER_IP>
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_PASSWORD=<YOUR_STRONG_PASSWORD>
PORT=3001
EOF

# Step 5: Start backend
docker compose up -d

# Wait for backend to be healthy (30 seconds)
sleep 30

# Step 6: Build frontend
cd ../frontend
npm install
npm run build

# Step 7: Install nginx
cd ..
sudo bash scripts/install-itms-nginx.sh

# Step 8: Verify installation
echo "=== Testing Installation ==="
curl http://localhost:3001/api/health
curl http://localhost/api/health
curl -I http://localhost/
docker ps | grep itms

# Step 9: Test login (replace with your password)
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"<YOUR_PASSWORD>"}'

echo ""
echo "✅ Installation complete!"
echo "🌐 Access: http://<YOUR_SERVER_IP>/"
echo "📧 Email: admin@zerodha.com"
echo "⚠️  Clear browser cache if you see 403 errors (Ctrl+Shift+R)"
```

**Verification Commands** (all should return success):

```bash
# Check backend health
curl http://localhost:3001/api/health
# Expected: {"database":"up","status":"ok","time":"..."}

# Check through nginx
curl http://localhost/api/health  
# Expected: {"database":"up","status":"ok","time":"..."}

# Check frontend
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# Check containers
docker ps | grep itms
# Expected: 2 containers (backend and postgres) both healthy

# Test login API
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASSWORD"}'
# Expected: {"token":"...","user":{...}}
```

**If browser shows 403 after successful curl tests:**
```bash
# The server is working. Tell users to:
# 1. Press Ctrl + Shift + R (hard refresh)
# 2. Or open Incognito: Ctrl + Shift + N
# 3. Or clear cache: Ctrl + Shift + Delete
```

For detailed explanations, see [Quick Start - Step by Step](#quick-start---step-by-step) below.

---

## Quick Start - Step by Step

Follow these steps for a complete production installation on a fresh Ubuntu server.

### Installation Checklist

Use this checklist to track your progress:

- [ ] Step 1: Prepare Your Server
- [ ] Step 2: Clone the Repository
- [ ] Step 3: Set Your Configuration
- [ ] Step 4: Install Docker and Start Backend
- [ ] Step 5: Configure Backend
- [ ] Step 6: Build and Deploy Frontend
- [ ] Step 7: Install Nginx
- [ ] Step 8: Optional - Install Server Integrations
- [ ] Step 9: Verify Installation
- [ ] Step 10: Access Your Installation
- [ ] Step 11: First Login Tasks

**Estimated time:** 25-35 minutes

---

### Step 1: Prepare Your Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install basic prerequisites
sudo apt install -y git curl wget
```

### Step 2: Clone the Repository

```bash
# Create application directory
sudo mkdir -p /home/itms
sudo chown $USER:$USER /home/itms

# Clone repository
cd /home/itms
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git itms
cd itms
```

### Step 3: Set Your Configuration

Create a configuration file with your settings:

```bash
# Create installation config
cat > install-config.sh << 'EOF'
export SERVER_IP="10.10.21.49"                          # Your server IP
export SERVER_NAME="itms.example.com"                   # Your domain/hostname
export DEFAULT_ADMIN_EMAIL="admin@zerodha.com"          # Admin email
export DEFAULT_ADMIN_PASSWORD="YourStrong#Pass2026"     # Change this!
export JWT_SECRET="YourLongRandomJWTSecret32chars+"     # Change this!
export SALT_API_PASSWORD="YourSaltPass#2026"            # Change this!
export WAZUH_API_PASSWORD="YourWazuhPass#2026"          # Change this!
EOF

# Load configuration
source install-config.sh
```

**⚠️ IMPORTANT**: Replace the password values above with your own strong passwords!

### Step 4: Install Docker and Start Backend

**Note:** If you have the all-in-one installer script available, you can use it instead:
```bash
# Alternative: If docs/install-itms-all-in-one.sh exists
bash docs/install-itms-all-in-one.sh
# Then skip to Step 9
```

Otherwise, follow these manual steps:

```bash
# Install Docker if not present
bash scripts/install-docker-and-start-itms.sh
```

Wait for Docker installation and backend startup to complete.

### Step 5: Configure Backend

```bash
cd backend

# The .env file may not exist yet, so create it
if [ ! -f .env ]; then
  cp .env.example .env
fi

# Update with your configuration from install-config.sh
source ../install-config.sh

# Update the .env file with your settings
sed -i "s|PUBLIC_SERVER_URL=.*|PUBLIC_SERVER_URL=http://${SERVER_IP}|g" .env
sed -i "s|DEFAULT_ADMIN_EMAIL=.*|DEFAULT_ADMIN_EMAIL=${DEFAULT_ADMIN_EMAIL}|g" .env
sed -i "s|DEFAULT_ADMIN_PASSWORD=.*|DEFAULT_ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}|g" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env

# Restart backend to apply changes
docker-compose down
docker-compose up -d

cd ..
```

### Step 6: Build and Deploy Frontend

```bash
# Install frontend dependencies
cd frontend
npm install

# Build production assets
npm run build

cd ..
```

### Step 7: Install Nginx

```bash
# Install and configure nginx
bash scripts/install-itms-nginx.sh
```

### Step 8: Optional - Install Server Integrations

```bash
# Load credentials from config
source install-config.sh

# Install SaltStack, Wazuh, and OpenSCAP
bash scripts/install-itms-server-integrations.sh
```

This will take 15-20 minutes for complete installation.

### Step 9: Verify Installation

```bash
# 1. Check backend health directly
curl http://localhost:3001/api/health
# Expected: {"database":"up","status":"ok","time":"..."}

# 2. Check backend through nginx
curl http://localhost/api/health
# Expected: {"database":"up","status":"ok","time":"..."}

# 3. Test login API endpoint works
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_ADMIN_PASSWORD"}'
# Expected: {"token":"...","user":{...}}

# 4. Check frontend is being served
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# 5. Check Docker containers are running
docker ps | grep itms
# Expected: zerodha-itms-backend and zerodha-itms-postgres both healthy

# 6. Optional: Run comprehensive smoke tests
bash scripts/smoke-test-itms-api.sh
bash scripts/smoke-test-itms-nginx.sh
```

**If all curl commands return success, your installation is complete! ✅**

### Step 10: Access Your Installation

Open your browser and navigate to:

```
http://YOUR_SERVER_IP/
```

**Login credentials:**
- Email: `admin@zerodha.com` (or what you set in config)
- Password: (the password you set in DEFAULT_ADMIN_PASSWORD)

**⚠️ If you see 403 Forbidden errors when trying to login:**

The installation is complete and the API is working. If you were testing the site before completing the installation, your browser may have cached old error responses. To fix this:

1. **Hard refresh** the page: Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. Or use **Incognito/Private mode**: `Ctrl + Shift + N` (Chrome/Edge) or `Ctrl + Shift + P` (Firefox)
3. Or **clear browser cache**: Press `Ctrl + Shift + Delete` and clear cookies and cache

See [Troubleshooting: 403 Forbidden on Login After Successful Installation](#403-forbidden-on-login-after-successful-installation-browser-cache-issue) for detailed instructions.

### Step 11: First Login Tasks

1. **Change admin password** - Go to profile settings and change your password
2. **Review settings** - Navigate to Settings to configure your organization
3. **Add users** - Go to Users section to add team members
4. **Configure integrations** - Set up any additional integrations needed

---

## Alternative: Development Installation Step by Step

If you want to set up a development environment instead, follow these steps:

### Development Setup Checklist

- [ ] Step 1: Clone Repository
- [ ] Step 2: Install Docker
- [ ] Step 3: Configure Backend
- [ ] Step 4: Start Backend
- [ ] Step 5: Configure Frontend
- [ ] Step 6: Start Frontend
- [ ] Step 7: Access Development Environment

**Estimated time:** 10-15 minutes

---

### Step 1: Clone Repository

```bash
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git
cd itms
```

### Step 2: Install Docker

```bash
bash scripts/install-docker-and-start-itms.sh
```

Wait for Docker installation to complete. You may need to log out and back in for group permissions to take effect.

### Step 3: Configure Backend

```bash
cd backend
cp .env.example .env
nano .env  # Edit configuration
```

**Minimum required settings in .env:**

```bash
DATABASE_URL=postgresql://itms_user:itms_pass@postgres:5432/itms
JWT_SECRET=your-jwt-secret-at-least-32-characters-long
PUBLIC_SERVER_URL=http://YOUR_SERVER_IP
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_PASSWORD=ChangeMe#2026
```

### Step 4: Start Backend

```bash
# From backend directory
bash ../scripts/start-itms-backend.sh
```

Wait for backend to be healthy (the script will check automatically).

### Step 5: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Step 6: Start Frontend

```bash
npm run dev
```

The development server will start at `http://localhost:5173`

### Step 7: Access Development Environment

Open your browser to:
- Frontend dev server: `http://localhost:5173`
- Backend API directly: `http://YOUR_SERVER_IP:3001/api/health`

---

## Update Existing Installation

**Already have ITMS installed?** Use this quick guide to update your existing server (e.g., 172.10.80.16) with the latest code changes.

### Quick Update Commands

```bash
# SSH to your server
ssh root@172.10.80.16

# Navigate to ITMS directory
cd /home/itms/itms

# Pull latest code
git pull origin main

# Update backend (rebuild and restart)
cd backend
docker-compose down
docker-compose up -d --build

# Update frontend (rebuild and redeploy)
cd ../frontend
npm install
npm run build
sudo rsync -av --delete dist/ /var/www/itms/

# Restart nginx
sudo systemctl restart nginx

# Verify update
curl http://localhost:3001/api/health
curl http://localhost/api/health
```

**Important Notes:**
- Always backup your database before updating
- Clear browser cache after update (Ctrl + Shift + R)
- Check logs if something doesn't work: `docker logs zerodha-itms-backend`

**For detailed update procedures, rollback instructions, and troubleshooting:** See [Update Existing Server Guide](docs/update-existing-server.md)

---

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or newer
- **RAM**: Minimum 4GB, recommended 8GB+
- **Disk Space**: Minimum 20GB available
- **Network**: Access to required ports (80, 443, 3001, 5432, 8000)

### Required Software

The installation scripts will install these automatically if missing:

- Docker Engine 20.10+
- Docker Compose Plugin
- Git
- curl, gpg, ca-certificates

For manual installation, you'll also need:
- Go 1.22.2+ (for backend development)
- Node.js 20+ and npm (for frontend development)
- PostgreSQL 15+ (runs in Docker by default)

---

## Quick Production Installation

### All-in-One Installation Script

For a complete production setup on a fresh Ubuntu server, use the all-in-one installer:

```bash
cd /path/to/itms

# Basic installation with defaults
SERVER_IP=10.10.21.49 \
DEFAULT_ADMIN_PASSWORD='YourStrong#Password2026' \
JWT_SECRET='YourLongRandomSecretValue' \
SALT_API_PASSWORD='YourSaltPassword#2026' \
WAZUH_API_PASSWORD='YourWazuhPassword#2026' \
bash docs/install-itms-all-in-one.sh
```

### Configuration Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REPO_URL` | GitHub repository URL | `https://github.com/Mohdgani-vibe/zerodha-itms.git` |
| `CLONE_DIR` | Installation directory | `/home/itms/itms` |
| `SERVER_IP` | Server IP address | (required) |
| `SERVER_NAME` | Server hostname/FQDN | Same as SERVER_IP |
| `DEFAULT_ADMIN_EMAIL` | Admin email | `admin@zerodha.com` |
| `DEFAULT_ADMIN_NAME` | Admin display name | `ITMS Admin` |
| `DEFAULT_ADMIN_PASSWORD` | Admin password | `ChangeMe-Admin#2026` |
| `JWT_SECRET` | JWT signing secret | `ChangeMe-JWT#2026-Replace-This-Immediately` |
| `SALT_API_PASSWORD` | SaltStack API password | `ChangeMe-Salt#2026` |
| `WAZUH_API_PASSWORD` | Wazuh API password | `ChangeMe-Wazuh#2026` |
| `WAZUH_AGENT_ID` | Wazuh agent ID | `000` |
| `INSTALL_CLAMAV` | Install ClamAV antivirus | `1` |
| `RUN_SECURITY_VERIFY` | Run security verification | `1` |

### What the All-in-One Script Does

1. Clones the repository to the specified directory
2. Installs Docker and Docker Compose if not present
3. Configures PostgreSQL database
4. Sets up backend environment and starts services
5. Builds and installs frontend
6. Configures nginx as reverse proxy
7. Installs server integrations (Salt, Wazuh)
8. Runs security verification tests
9. Provides access at `http://SERVER_IP/`

---

## Development Installation

This is a detailed guide for setting up a local development environment.

### Development Installation Checklist

- [ ] Step 1: Clone Repository
- [ ] Step 2: Verify Prerequisites
- [ ] Step 3: Install Docker
- [ ] Step 4: Backend Setup (4.1-4.4)
- [ ] Step 5: Frontend Setup (5.1-5.4)
- [ ] Step 6: Access Development Environment
- [ ] Step 7: Development Workflow
- [ ] Step 8: Alternative Startup Methods
- [ ] Step 9: Stopping Services

**Estimated time:** 20-30 minutes

---

### Step 1: Clone Repository

```bash
git clone https://github.com/Mohdgani-vibe/zerodha-itms.git
cd itms
```

### Step 2: Verify Prerequisites

Check that you have required tools:

```bash
# Check Git
git --version

# Check if Docker is installed
docker --version || echo "Docker not installed"

# Check if Docker Compose is available
docker compose version || docker-compose --version || echo "Docker Compose not installed"
```

### Step 3: Install Docker (if needed)

If Docker is not installed:

```bash
bash scripts/install-docker-and-start-itms.sh
```

This will:
- Install Docker Engine
- Install Docker Compose plugin
- Add your user to the docker group
- Start Docker service

**Important**: After installation, log out and log back in for group permissions to take effect, or run:

```bash
newgrp docker
```

### Step 4: Backend Setup

#### 4.1: Create Backend Environment File

```bash
cd backend
cp .env.example .env
```

#### 4.2: Edit Backend Configuration

```bash
nano .env
```

**Minimum required configuration:**

```bash
# Database (Docker compose will create this)
DATABASE_URL=postgresql://itms_user:itms_pass@postgres:5432/itms

# JWT Settings
JWT_SECRET=your-development-jwt-secret-at-least-32-characters-long
JWT_EXPIRY_HOURS=24

# Server Settings
PORT=3001
PUBLIC_SERVER_URL=http://YOUR_SERVER_IP

# Default Admin (will be created on first run)
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_NAME=ITMS Admin
DEFAULT_ADMIN_PASSWORD=DevAdmin#2026

# Google OAuth (optional for development)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
GOOGLE_REDIRECT_URL=http://YOUR_SERVER_IP:3001/api/auth/google/callback

# Integrations (optional)
ENABLE_INVENTORY_SYNC=0
SALT_API_URL=http://YOUR_SERVER_IP:8000
WAZUH_API_URL=https://YOUR_SERVER_IP:55000
```

#### 4.3: Start Backend

```bash
bash ../scripts/start-itms-backend.sh
```

This script will:
- Detect docker compose command (v2 or v1)
- Remove any stale backend containers
- Start PostgreSQL and backend containers
- Wait for health check to pass
- Display backend logs

You should see output like:
```
✓ Backend is healthy and responding at http://YOUR_SERVER_IP:3001/api/health
```

#### 4.4: Verify Backend is Running

```bash
# Check container status
docker ps | grep itms

# Test API health endpoint
curl http://YOUR_SERVER_IP:3001/api/health
# Should return: {"status":"healthy"}

# Check backend logs
cd backend
docker-compose logs -f backend
```

Press Ctrl+C to stop following logs.

### Step 5: Frontend Setup

#### 5.1: Install Node.js (if needed)

Check Node.js version:

```bash
node --version
# Should be v20.x or higher
```

If not installed or version is old:

```bash
# Install Node.js 20.x on Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### 5.2: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

This will take a few minutes. If you encounter permission errors:

```bash
sudo chown -R $USER:$USER ~/.npm
npm install
```

#### 5.3: Create Frontend Environment File

```bash
# Create .env.development for local development
cat > .env.development << 'EOF'
# Backend API URL for development
VITE_API_ORIGIN=http://YOUR_SERVER_IP:3001
VITE_WS_ORIGIN=ws://YOUR_SERVER_IP:3001

# Google OAuth (optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
EOF
```

#### 5.4: Start Frontend Development Server

```bash
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://YOUR_SERVER_IP:5173/
```

The development server includes:
- ✅ Hot module replacement (HMR)
- ✅ Instant updates on file changes
- ✅ Detailed error messages
- ✅ Source maps for debugging

### Step 6: Access Development Environment

Open your browser to:

**Frontend (recommended for development):**
```
http://localhost:5173
```

**Backend API directly:**
```
http://YOUR_SERVER_IP:3001/api/health
```

**Login:**
- Email: `admin@zerodha.com`
- Password: `DevAdmin#2026` (or whatever you set)

### Step 7: Development Workflow

Now you can start developing:

1. **Edit frontend code** - Files in `frontend/src/` will auto-reload
2. **Edit backend code** - Requires rebuild: `cd backend && docker-compose up -d --build backend`
3. **View logs** - `docker-compose logs -f backend`
4. **Run tests** - See testing section below

### Step 8: Alternative - Start Both Services Together

From the repository root, you can start both backend and frontend:

```bash
# Start both (frontend in terminal)
bash scripts/start-itms.sh

# Or start frontend in background
FRONTEND_BACKGROUND=1 bash scripts/start-itms.sh

# Or use Make
make start
make start-detached
```

### Step 9: Stopping Services

To stop development servers:

```bash
# Stop frontend (if running in terminal)
Press Ctrl+C

# Stop backend
cd backend
docker-compose down

# Or stop both
bash scripts/stop-itms.sh

# Or use Make
make stop
```

### Testing Your Development Setup

```bash
# Run backend tests (if available)
cd backend
go test ./...

# Run frontend linter
cd frontend
npm run lint

# Build frontend to check for errors
npm run build
```

---

## Production Deployment with Nginx

This section is for manual nginx deployment. Use this if you need more control over the installation process.

### Production Deployment Checklist

- [ ] Step 1: Prepare the System
- [ ] Step 2: Configure Backend Environment
- [ ] Step 3: Start Backend
- [ ] Step 4: Install Frontend Dependencies
- [ ] Step 5: Configure Frontend Environment
- [ ] Step 6: Build Frontend
- [ ] Step 7: Install and Configure Nginx
- [ ] Step 8: Verify Nginx Configuration
- [ ] Step 9: Test the Installation
- [ ] Step 10: Configure Firewall
- [ ] Step 11: Access Your Application
- [ ] Step 12: Post-Deployment Tasks

**Estimated time:** 25-35 minutes

---

### Step 1: Prepare the System

```bash
# Update system
sudo apt update

# Ensure Docker is installed
bash scripts/install-docker-and-start-itms.sh
```

### Step 2: Configure Backend Environment

```bash
cd backend

# Copy and edit environment file
cp .env.example .env
nano .env
```

**Critical environment variables:**

```bash
DATABASE_URL=postgresql://itms_user:strong_password@postgres:5432/itms
JWT_SECRET=generate-a-long-random-string-at-least-32-chars
PUBLIC_SERVER_URL=http://your-server-ip-or-domain
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_PASSWORD=YourStrong#AdminPassword2026
PORT=3001

# Optional integrations
SALT_API_URL=http://YOUR_SERVER_IP:8000
SALT_API_USERNAME=salt-api
SALT_API_PASSWORD=your-salt-password
WAZUH_API_URL=https://YOUR_SERVER_IP:55000
WAZUH_API_USERNAME=wazuh-api
WAZUH_API_PASSWORD=your-wazuh-password
```

### Step 3: Start Backend

```bash
# Start backend with Docker Compose
bash ../scripts/start-itms-backend.sh
```

Wait for the health check to pass. The script will verify the backend is responding.

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

If you encounter permission errors:

```bash
sudo chown -R $USER:$USER .
npm install
```

### Step 5: Configure Frontend Environment

```bash
cd frontend

# For production, leave API origins empty to use nginx proxy
cat > .env.production << 'EOF'
# Leave empty for same-origin /api through nginx
VITE_API_ORIGIN=
VITE_WS_ORIGIN=

# Google OAuth (if using)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
EOF
```

### Step 6: Build Frontend

```bash
npm run build
```

This creates optimized production assets in `frontend/dist/`. The build should complete without errors.

Verify the build:

```bash
ls -lh dist/
# Should show index.html and assets/ directory
```

### Step 7: Install and Configure Nginx

```bash
cd ..
bash scripts/install-itms-nginx.sh
```

This script will:
- Install nginx if not present
- Create nginx configuration for ITMS
- Configure reverse proxy for `/api` → backend:3001
- Configure WebSocket proxy for `/ws` → backend:3001
- Serve static files from `frontend/dist/`
- Enable and start nginx service

### Step 8: Verify Nginx Configuration

```bash
# Test nginx configuration syntax
sudo nginx -t

# Check nginx status
sudo systemctl status nginx

# Verify nginx is listening on port 80
sudo ss -tlnp | grep :80
```

### Step 9: Test the Installation

```bash
# Test backend API through nginx
curl http://localhost/api/health
# Should return: {"status":"healthy"}

# Test frontend is being served
curl -I http://localhost/
# Should return: 200 OK

# Run comprehensive smoke tests
bash scripts/smoke-test-itms-api.sh
bash scripts/smoke-test-itms-nginx.sh
```

### Step 10: Configure Firewall (Optional but Recommended)

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If UFW is not enabled yet
sudo ufw enable
```

### Step 11: Access Your Application

Open your browser and navigate to:

```
http://YOUR_SERVER_IP/
```

You should see the ITMS login page.

**Default login:**
- Email: `admin@zerodha.com`
- Password: (what you set in DEFAULT_ADMIN_PASSWORD)

**⚠️ If you encounter 403 Forbidden errors on login:**

Your browser may have cached old responses if you tested the site before completing the installation. Quick fix:
- **Hard refresh**: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- **Incognito mode**: `Ctrl + Shift + N` (Chrome/Edge) or `Ctrl + Shift + P` (Firefox)
- See [Troubleshooting: Browser Cache Issue](#403-forbidden-on-login-after-successful-installation-browser-cache-issue) for more details

### Step 12: Post-Deployment Tasks

1. **Change admin password immediately**
2. **Set up SSL/TLS certificates** (see SSL Configuration section below)
3. **Configure backup schedule** for PostgreSQL
4. **Set up monitoring and alerts**
5. **Review and harden security settings**

### SSL Configuration (Optional)

To enable HTTPS with Let's Encrypt:

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Test certificate renewal
sudo certbot renew --dry-run
```

The certbot will automatically update your nginx configuration for HTTPS.

---

## Configuration

### Port Layout

| Service | Port | Access |
|---------|------|--------|
| Frontend (nginx) | 80 | `http://YOUR_SERVER_IP/` |
| Frontend (nginx SSL) | 443 | `https://YOUR_SERVER_IP/` |
| Backend API (via nginx) | 80 | `http://YOUR_SERVER_IP/api/*` |
| Backend Container | 3001 | `http://YOUR_SERVER_IP:3001` (internal) |
| Secondary Backend | 3012 | `http://YOUR_SERVER_IP:3012` |
| PostgreSQL | 5432 | `localhost:5432` (Docker network) |
| Salt API | 8000 | `http://YOUR_SERVER_IP:8000` |
| Frontend Dev Server | 5173 | `http://YOUR_SERVER_IP:5173` (dev only) |
| Frontend Preview | 4175 | `http://YOUR_SERVER_IP:4175` (preview only) |

### Default Credentials

**Admin Account:**
- Email: `admin@zerodha.com`
- Password: `ChangeMe-Admin#2026`

**⚠️ SECURITY WARNING**: Change the default admin password immediately after first login!

### Environment Variables

#### Backend (.env in backend/)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-secret-key-minimum-32-chars
JWT_EXPIRY_HOURS=24
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URL=http://your-server/api/auth/google/callback

# Server
PORT=3001
PUBLIC_SERVER_URL=http://your-server-ip-or-domain

# Admin User (for seed)
DEFAULT_ADMIN_EMAIL=admin@zerodha.com
DEFAULT_ADMIN_NAME=ITMS Admin
DEFAULT_ADMIN_PASSWORD=your-strong-password

# Integrations
SALT_API_URL=http://YOUR_SERVER_IP:8000
SALT_API_USERNAME=salt-api
SALT_API_PASSWORD=your-salt-password
WAZUH_API_URL=https://YOUR_SERVER_IP:55000
WAZUH_API_USERNAME=wazuh-api
WAZUH_API_PASSWORD=your-wazuh-password
WAZUH_AGENT_ID=000

# Features
ENABLE_INVENTORY_SYNC=1
INVENTORY_SYNC_SCHEDULE=0 2 * * *
```

#### Frontend (.env.production in frontend/)

```bash
# API Configuration
# Leave empty to use same-origin /api through nginx (recommended)
VITE_API_ORIGIN=
VITE_WS_ORIGIN=

# Or specify explicit origins if bypassing nginx
# VITE_API_ORIGIN=http://YOUR_SERVER_IP:3001
# VITE_WS_ORIGIN=ws://YOUR_SERVER_IP:3001

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

---

## Additional Components

### Installing Server Integrations (SaltStack, Wazuh, OpenSCAP)

These integrations add configuration management, security monitoring, and compliance scanning capabilities.

#### Step 1: Prepare Integration Credentials

Create a file with your integration credentials:

```bash
cat > /tmp/integration-creds.sh << 'EOF'
export SALT_API_PASSWORD="YourSaltPassword#2026"
export WAZUH_API_PASSWORD="YourWazuhPassword#2026"
export WAZUH_AGENT_ID="000"
EOF

source /tmp/integration-creds.sh
```

#### Step 2: Run Integration Installer

```bash
bash scripts/install-itms-server-integrations.sh
```

This will install and configure:
- **SaltStack API**: Configuration management and remote command execution
- **Wazuh Agent**: Security event monitoring and threat detection
- **OpenSCAP Scanner**: Security compliance and vulnerability scanning

The installation takes 15-20 minutes.

#### Step 3: Verify Integrations

```bash
# Check all integrations
bash scripts/verify-itms-security-integrations.sh

# Check individual services
bash scripts/check-itms-server-integrations.sh

# Check OpenSCAP specifically
bash scripts/check-itms-openscap-status.sh
```

#### Step 4: Update Backend Configuration

Add integration URLs to your backend .env:

```bash
cd backend
nano .env
```

Add these lines:

```bash
# SaltStack Integration
SALT_API_URL=http://YOUR_SERVER_IP:8000
SALT_API_USERNAME=salt-api
SALT_API_PASSWORD=YourSaltPassword#2026

# Wazuh Integration
WAZUH_API_URL=https://YOUR_SERVER_IP:55000
WAZUH_API_USERNAME=wazuh-api
WAZUH_API_PASSWORD=YourWazuhPassword#2026
WAZUH_AGENT_ID=000
```

#### Step 5: Restart Backend

```bash
docker-compose restart backend

# Verify integration connectivity
curl http://localhost/api/health
```

---

### Installing ITMS Agent on Client Machines

The ITMS agent enables system inventory collection, remote management, and security monitoring.

#### Linux Agent Installation

##### Step 1: Download Agent Installer

On the client machine:

```bash
# Download from your ITMS server
curl -O http://YOUR_ITMS_SERVER_IP/scripts/install-itms-agent.sh

# Or copy from the repository
scp scripts/install-itms-agent.sh user@client-machine:/tmp/
```

##### Step 2: Configure Server IP

```bash
export SERVER_IP="10.10.21.49"  # Your ITMS server IP
```

##### Step 3: Run Agent Installer

```bash
# With server IP
SERVER_IP=10.10.21.49 bash install-itms-agent.sh

# Or if you set the export above
bash install-itms-agent.sh
```

##### Step 4: Verify Agent Installation

```bash
# Check if agent service is running
systemctl status itms-agent

# Test connectivity to server
curl http://YOUR_ITMS_SERVER_IP/api/health

# Check agent logs
journalctl -u itms-agent -f
```

#### Windows Agent Installation

##### Step 1: Download Agent Installer

On the Windows client machine, open PowerShell as Administrator:

```powershell
# Download from ITMS server
Invoke-WebRequest -Uri "http://YOUR_ITMS_SERVER_IP/scripts/install-itms-agent.ps1" -OutFile "install-itms-agent.ps1"
```

##### Step 2: Set Execution Policy (if needed)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

##### Step 3: Configure and Run Installer

```powershell
# Set server IP
$env:SERVER_IP = "10.10.21.49"

# Run installer
.\install-itms-agent.ps1
```

##### Step 4: Verify Windows Agent

```powershell
# Check if service is running
Get-Service -Name "ITMSAgent"

# Test connectivity
Invoke-WebRequest -Uri "http://YOUR_ITMS_SERVER_IP/api/health"

# Check agent logs
Get-EventLog -LogName Application -Source ITMSAgent -Newest 50
```

---

### Setting Up SSH Key Management

Enable SSH-based remote access for managed devices.

#### Step 1: Generate SSH Key (if needed)

```bash
# Check if SSH key exists
ls -la ~/.ssh/id_rsa

# Generate new key if needed
ssh-keygen -t rsa -b 4096 -C "itms-server@zerodha.com"
```

#### Step 2: Install SSH Key on ITMS Server

```bash
bash scripts/install-itms-ssh-key.sh
```

This will:
- Copy SSH public key to authorized locations
- Set correct permissions
- Configure SSH daemon settings

#### Step 3: Test SSH Access

```bash
# Test SSH to a managed device
ssh user@client-device-ip

# Or test through ITMS
# Access Terminal page in ITMS UI and initiate SSH connection
```

---

### Setting Up OpenSCAP Security Scanning

Configure automated security compliance scanning.

#### Step 1: Install OpenSCAP Runner

```bash
bash scripts/install-itms-openscap-runner.sh
```

For user-based runner (runs as specific user):

```bash
bash scripts/install-itms-openscap-user-runner.sh
```

#### Step 2: Set Up Security Content

```bash
bash scripts/setup-itms-openscap-content.sh
```

This downloads and configures:
- SCAP security profiles
- CIS benchmarks
- STIG guidelines
- CVE vulnerability feeds

#### Step 3: Configure Scan Schedule

Edit the cron schedule:

```bash
sudo crontab -e
```

Add a daily scan at 2 AM:

```cron
0 2 * * * /usr/local/bin/itms-openscap-runner
```

#### Step 4: Run Manual Scan

```bash
# Run scan manually
sudo /usr/local/bin/itms-openscap-runner

# Check scan status
bash scripts/check-itms-openscap-status.sh
```

#### Step 5: Configure Alert Management

```bash
# Set up alert notifications
bash scripts/manage-itms-openscap-alert.sh
```

#### Step 6: View Scan Results

Results are available in:
- ITMS UI: Navigate to Security > Compliance Dashboard
- Command line: `bash scripts/check-itms-openscap-status.sh`
- Log files: `/var/log/itms-openscap/`

---

### Installing Additional Tools

#### Install Nginx (Standalone)

If you need to install nginx separately:

```bash
bash scripts/install-itms-nginx.sh
```

#### Setup Salt Fileserver Sync

For SaltStack file distribution:

```bash
bash scripts/sync-itms-salt-fileserver.sh
```

#### Rotate API Secrets

To rotate JWT and API secrets:

```bash
bash scripts/rotate-itms-api-secrets.sh
```

This will:
- Generate new JWT secret
- Update backend configuration
- Restart services with new secrets
- Invalidate existing tokens (users must re-login)

---

## Verification

### Quick Status Check

```bash
# Check overall system status
make status

# Or use the script
bash scripts/verify-itms-stack.sh
```

### Smoke Tests

Run comprehensive smoke tests:

```bash
# Full smoke test suite
make smoke-test

# Individual component tests
bash scripts/smoke-test-itms-api.sh
bash scripts/smoke-test-itms-nginx.sh
bash scripts/smoke-test-itms-chat.sh
bash scripts/smoke-test-itms-chat-live.sh
bash scripts/smoke-test-itms-installer.sh
bash scripts/smoke-test-itms-role-matrix.sh
```

### Health Endpoints

```bash
# Backend health
curl http://localhost/api/health

# Backend detailed status
curl http://localhost/api/status

# Check database connectivity
curl http://localhost/api/health/db
```

### Release Readiness Check

Before deploying to production:

```bash
bash scripts/check-itms-release-readiness.sh
```

---

## Troubleshooting

### All-in-One Script Not Found

If you get `bash: docs/install-itms-all-in-one.sh: No such file or directory`:

**Cause:** Your repository clone may be incomplete or from an older version.

**Solution:** Use the manual step-by-step installation in [Quick Start](#quick-start---step-by-step) Steps 4-8, which uses the modular scripts from the `scripts/` directory.

**Alternative:** Copy the script from the main repository:
```bash
# Download the all-in-one script
curl -o docs/install-itms-all-in-one.sh https://raw.githubusercontent.com/Mohdgani-vibe/zerodha-itms/main/docs/install-itms-all-in-one.sh
chmod +x docs/install-itms-all-in-one.sh

# Then run it
bash docs/install-itms-all-in-one.sh
```

---

### npm Command Not Found

If you see `Command 'npm' not found`:

**Cause:** Node.js is not installed.

**Solution:**

```bash
# Install Node.js 20.x (includes npm)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version
```

**Note:** npm is included with Node.js installation. You don't need to install it separately.

---

### 403 Forbidden Error on API Calls

If you see `403 Forbidden` errors when accessing the application or making API calls:

**Error in browser console:**
```
Failed to load resource: the server responded with a status of 403 (Forbidden)
api/auth/login:1  Failed to load resource: the server responded with a status of 403 (Forbidden)
```

**Cause:** Nginx is not properly configured to proxy API requests to the backend, or file permissions are incorrect.

**Solution 1: Check Backend is Running**

```bash
# Check if backend is healthy
docker compose -f /home/itms/itms/backend/docker-compose.yml ps

# Test backend directly (bypassing nginx)
curl http://localhost:3001/api/health
# Should return: {"status":"healthy"}

# If backend is not running, start it
cd /home/itms/itms/backend
docker compose up -d
```

**Solution 2: Verify Nginx Configuration**

```bash
# Check nginx configuration file
cat /etc/nginx/sites-available/itms

# The config should have API proxy settings like:
# location /api/ {
#     proxy_pass http://localhost:3001;
#     proxy_http_version 1.1;
#     proxy_set_header Host $host;
#     ...
# }

# Test nginx config syntax
sudo nginx -t

# Reload nginx if config is OK
sudo systemctl reload nginx
```

**Solution 3: Fix File Permissions**

```bash
# Ensure frontend files have correct permissions
sudo chmod -R 755 /home/itms/itms/frontend/dist
sudo chown -R www-data:www-data /home/itms/itms/frontend/dist

# Restart nginx
sudo systemctl restart nginx
```

**Solution 4: Reinstall Nginx Configuration**

If the config is missing or wrong, reinstall it:

```bash
cd /home/itms/itms

# Remove old config
sudo rm -f /etc/nginx/sites-enabled/itms
sudo rm -f /etc/nginx/sites-available/itms

# Reinstall with correct paths
bash scripts/install-itms-nginx.sh

# Test it works
curl http://localhost/api/health
# Should return: {"status":"healthy"}

# Test in browser
curl -I http://localhost/
# Should return: 200 OK
```

**Solution 5: Check Firewall Rules**

```bash
# Check firewall status
sudo ufw status

# Allow nginx through firewall
sudo ufw allow 'Nginx Full'

# On SELinux systems, allow nginx network connections
sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true
```

**Debug Steps:**

```bash
# 1. Check nginx error logs for details
sudo tail -50 /var/log/nginx/error.log

# 2. Check nginx access logs
sudo tail -50 /var/log/nginx/access.log

# 3. Test backend API directly
curl -v http://localhost:3001/api/auth/current-user

# 4. Test through nginx proxy
curl -v http://localhost/api/auth/current-user

# 5. Check what nginx is serving
curl -I http://localhost/

# 6. Verify backend is listening
sudo ss -tlnp | grep 3001
```

**Common Nginx Config Issues:**

1. **Wrong root path** - Check `root /home/itms/itms/frontend/dist;`
2. **Missing try_files** - Should have `try_files $uri $uri/ /index.html;`
3. **Wrong proxy_pass** - Should be `http://localhost:3001` not `http://localhost:3001/`
4. **Missing backend** - Backend must be running on port 3001

---

### 403 Forbidden on Login After Successful Installation (Browser Cache Issue)

If the API works via curl but you still see `403 Forbidden` in the browser after fixing nginx and restarting services:

**Symptoms:**
- ✅ `curl http://localhost/api/health` returns `{"status":"ok","database":"up"}`
- ✅ `curl -X POST http://localhost/api/auth/login -d '{"email":"...","password":"..."}' -H "Content-Type: application/json"` returns JWT token
- ❌ Browser shows: `POST http://172.10.80.16/api/auth/login 403 (Forbidden)`
- ❌ Login page doesn't work even though backend is healthy

**Cause:** Your browser has cached the old 403 response or old JavaScript files from before the installation was fixed. The API is working correctly, but the browser is using stale cached data.

**Solution: Clear Browser Cache**

Choose one of these methods:

#### Method 1: Hard Refresh (Quickest)
```
Windows/Linux: Ctrl + Shift + R (or Ctrl + F5)
Mac: Cmd + Shift + R
```

Press this key combination 2-3 times on the login page.

#### Method 2: Clear Site Data (Most Reliable)
1. Open DevTools: Press **F12**
2. Go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
3. Click **"Clear site data"** or **"Clear storage"**
4. Check all boxes:
   - ✅ Cookies
   - ✅ Cache
   - ✅ Local Storage
   - ✅ Session Storage
5. Click **"Clear site data"**
6. **Close the browser completely** (not just the tab)
7. Reopen and navigate to `http://YOUR_SERVER_IP/`

#### Method 3: Disable Cache in DevTools
1. Open DevTools: Press **F12**
2. Go to **Network** tab
3. Check **"Disable cache"** checkbox
4. Keep DevTools open
5. Refresh the page with **F5**

#### Method 4: Use Incognito/Private Window (Fastest Test)
```
Chrome/Edge: Ctrl + Shift + N
Firefox: Ctrl + Shift + P
Safari: Cmd + Shift + N
```

Then navigate to: `http://YOUR_SERVER_IP/`

If login works in incognito mode, it confirms the issue is browser caching.

#### Method 5: Clear All Browser Data
**Chrome/Edge:**
1. Press **Ctrl + Shift + Delete**
2. Select **"All time"** from time range
3. Check:
   - ✅ Cookies and other site data
   - ✅ Cached images and files
4. Click **"Clear data"**
5. Close browser completely and reopen

**Firefox:**
1. Press **Ctrl + Shift + Delete**
2. Select **"Everything"** from time range
3. Check:
   - ✅ Cookies
   - ✅ Cache
4. Click **"Clear Now"**
5. Close Firefox completely and reopen

**Verification:**

After clearing cache, test again:
```bash
# Verify API is working (run this on the server)
curl -X POST http://YOUR_SERVER_IP/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASSWORD"}'
```

If curl returns a JWT token but browser still fails after clearing cache, check the "403 Forbidden Error on API Calls" section above for nginx configuration issues.

#### Quick Reference: Commands to Share with End Users

If users report login issues after installation, share these steps:

**For System Administrators (verify server is working):**
```bash
# Test on server - both should return success
curl http://localhost/api/health
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASSWORD"}'
```

**For End Users (clear browser cache):**
```
The server is working correctly. Please clear your browser cache:

Quick Fix:
- Press Ctrl + Shift + R (Windows/Linux) or Cmd + Shift + R (Mac) 2-3 times
- Or open in Incognito/Private window: Ctrl + Shift + N

If that doesn't work:
1. Press Ctrl + Shift + Delete
2. Select "All time" 
3. Check "Cookies" and "Cache"
4. Click "Clear data"
5. Close browser completely and reopen

Then visit: http://YOUR_SERVER_IP/
```

**Alternative: Add Cache-Busting to Nginx (prevents future issues):**
```bash
# Add versioning to prevent cache issues in production
sudo nano /etc/nginx/sites-available/itms

# Add this inside the server block:
#   add_header Cache-Control "no-cache, no-store, must-revalidate" always;
#   add_header Pragma "no-cache" always;
#   add_header Expires "0" always;

# Then reload:
sudo nginx -t && sudo systemctl reload nginx
```

---

### Docker Compose Command Not Found

If you see `Command 'docker-compose' not found`:

**Cause:** You're using Docker Compose Plugin (v2) which uses `docker compose` (with space), not `docker-compose` (with hyphen).

**Solution:**

The installation scripts automatically detect the correct command. However, if running commands manually:

```bash
# Use this (Docker Compose v2):
docker compose up -d
docker compose down
docker compose logs

# NOT this (Docker Compose v1, deprecated):
docker-compose up -d
docker-compose down
```

If you prefer the old `docker-compose` command:

```bash
apt install docker-compose
```

However, Docker Compose v2 (plugin) is recommended and already installed by the Docker Engine.

---

### Backend Password Validation Error

If backend keeps restarting with password validation errors:

**Error:**
```
hash default admin password: password must include at least one uppercase letter
zerodha-itms-backend exited with code 1 (restarting)
```

**Cause:** The `DEFAULT_ADMIN_PASSWORD` doesn't meet complexity requirements.

**Requirements:**
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)
- Minimum 8 characters

**Solution:**

```bash
cd /home/itms/itms/backend

# Update your password to meet requirements
# Example: Zer0dhA@2026 (has uppercase, lowercase, numbers, special chars)
nano .env

# Find and update this line:
# DEFAULT_ADMIN_PASSWORD=YourStrong#Pass2026

# Restart backend
docker compose down
docker compose up -d

# Check logs to verify it started successfully
docker compose logs backend
```

---

### Node.js Version Error

If you see `Vite requires Node.js version 20.19+ or 22.12+`:

**Error:**
```
You are using Node.js 18.20.8. Vite requires Node.js version 20.19+ or 22.12+.
ReferenceError: CustomEvent is not defined
```

**Solution:**

```bash
# Remove old Node.js version
apt remove -y nodejs

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify version (should be 20.x)
node --version

# Clean and reinstall frontend dependencies
cd /home/itms/itms/frontend
rm -rf node_modules package-lock.json
npm install

# Rebuild frontend
npm run build
```

---

### Unregistered Email Error on Login

If you get `{"error":"unregistered email"}` when trying to login:

**Error:**
```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASSWORD"}'

# Response: {"error":"unregistered email"}
```

**Cause:** The default admin user was not created during backend startup, or the database was reset.

**Solution:**

```bash
# Check if backend started successfully
cd /home/itms/itms/backend
docker compose logs backend | grep -i "admin\|error\|fatal"

# If password validation error, fix it (see "Backend Password Validation Error" section above)

# If no errors, restart backend to trigger admin user creation
docker compose down
docker compose up -d

# Wait for backend to be healthy
sleep 30

# Check logs for admin creation
docker compose logs backend | grep -i admin

# You should see something like:
# "Created default admin user with email: admin@zerodha.com"

# Test login again
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASSWORD"}'

# Should return: {"token":"...","user":{...}}
```

**Verification:**

Check backend environment variables are correct:
```bash
cd /home/itms/itms/backend
grep DEFAULT_ADMIN .env

# Should show:
# DEFAULT_ADMIN_EMAIL=admin@zerodha.com
# DEFAULT_ADMIN_PASSWORD=<your-password>
# DEFAULT_ADMIN_NAME=ITMS Admin
```

**How to know if admin user was created:**

Error progression shows whether user exists:
1. `{"error":"unregistered email"}` → Admin user doesn't exist yet
2. `{"error":"wrong password"}` → **Admin user exists!** Just need correct password

**If you get "wrong password" error:**

```bash
# Check the password in your .env file
cd /home/itms/itms/backend
cat .env | grep DEFAULT_ADMIN_PASSWORD

# Test login with the EXACT password from .env
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"PASTE_EXACT_PASSWORD_HERE"}'

# Common mistake: Zer0 (with zero) vs ZerO (with letter O)
```

**Verify admin user in database:**

```bash
# Check user exists (adjust -U postgres or -U itms_user based on your DB setup)
docker exec -it zerodha-itms-postgres psql -U postgres -d itms \
  -c "SELECT email, role, full_name, emp_id FROM users WHERE email='admin@zerodha.com';"

# Should show: muhammed.gani@zerodha.com | super_admin | ITMS Admin | EMP001
```

**Alternative - Manual Admin User Creation:**

If automatic creation doesn't work, create the admin user manually via database:

```bash
# Connect to database (try -U postgres or -U itms_user)
docker exec -it zerodha-itms-postgres psql -U postgres -d itms

# Check if users table exists
\dt

# If table exists, check for admin user
SELECT email, role FROM users WHERE email = 'admin@zerodha.com';

# If no admin user exists, backend should create it on next restart
# Exit psql
\q

# Restart backend with logs visible
docker compose up
```

**Common Issues:**

1. **Wrong email format**: Must be `@zerodha.com` domain
2. **Wrong password**: Check exact password in .env (watch for 0 vs O, 1 vs l, etc.)
3. **Password not meeting requirements**: Check "Backend Password Validation Error" section
4. **Database not initialized**: Backend needs to run successfully once to create tables and seed admin user
5. **Multiple backend restarts**: If backend is crash-looping, admin user never gets created

---

### Backend Won't Start

1. **Check Docker status:**
   ```bash
   sudo systemctl status docker
   docker ps
   ```

2. **Check backend logs:**
   ```bash
   cd backend
   docker-compose logs backend
   ```

3. **Check PostgreSQL:**
   ```bash
   docker-compose logs postgres
   docker-compose exec postgres psql -U itms_user -d itms -c "SELECT version();"
   ```

4. **Restart services:**
   ```bash
   cd backend
   docker-compose down
   docker-compose up -d
   ```

### Frontend Build Fails

1. **Clear node_modules and reinstall:**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 20.x or higher
   ```

3. **Run linter:**
   ```bash
   npm run lint
   ```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using a port
sudo lsof -i :3001
sudo lsof -i :5432

# Kill process if needed
sudo kill -9 <PID>
```

### Database Connection Errors

1. **Verify DATABASE_URL in .env:**
   ```bash
   cat backend/.env | grep DATABASE_URL
   ```

2. **Test direct connection:**
   ```bash
   docker-compose exec postgres psql -U itms_user -d itms
   ```

3. **Check network:**
   ```bash
   docker network ls
   docker network inspect backend_default
   ```

### Nginx Issues

1. **Test nginx configuration:**
   ```bash
   sudo nginx -t
   ```

2. **Check nginx logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   sudo tail -f /var/log/nginx/access.log
   ```

3. **Restart nginx:**
   ```bash
   sudo systemctl restart nginx
   ```

### Permission Errors

```bash
# Fix Docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Clean Restart

For a complete clean restart:

```bash
# Stop all services
make stop

# Remove Docker containers and volumes
cd backend
docker-compose down -v

# Remove old builds
cd ../frontend
rm -rf dist node_modules

# Restart from scratch
cd ..
make start
```

---

## Useful Commands

### Make Targets (from repo root)

```bash
make start              # Start backend + frontend
make start-detached     # Start in background
make stop               # Stop all services
make restart            # Restart all services
make status             # Check service status
make smoke-test         # Run smoke tests
make installer-smoke-test  # Test installer
```

### Backend Commands (from backend/)

```bash
make run                # Run backend in Docker
make run-host           # Run backend on host (for debugging)
make start              # Start backend container
make stop               # Stop backend container
make logs               # View backend logs
make db-migrate         # Run database migrations
make db-seed            # Seed initial data
make test               # Run backend tests
```

### Frontend Commands (from frontend/)

```bash
npm run dev             # Development server with hot reload
npm run build           # Production build
npm run preview         # Preview production build locally
npm run preview:stable  # Preview on fixed port 4175
npm run lint            # Run ESLint
npm test                # Run tests
```

---

## Security Notes

1. **Change default passwords immediately** after installation
2. **Use strong JWT secrets** (minimum 32 characters, random)
3. **Enable HTTPS** with valid SSL certificates in production
4. **Configure firewall** to restrict access to internal ports
5. **Keep secrets in .env files** - never commit them to Git
6. **Regular backups** of PostgreSQL database
7. **Update dependencies** regularly for security patches

---

## Support and Documentation

- **Main README**: [README.md](README.md)
- **Backend README**: [backend/README.md](backend/README.md)
- **Frontend README**: [frontend/README.md](frontend/README.md)
- **Deployment Handoff**: [docs/deployment-handoff.md](docs/deployment-handoff.md)
- **Release Notes**: [docs/release-note-2026-04-22.md](docs/release-note-2026-04-22.md)
- **Security Hardening**: [docs/release-hardening-summary-2026-04-22.md](docs/release-hardening-summary-2026-04-22.md)
- **Fleet Rollout Checklist**: [docs/fleet-rollout-checklist.md](docs/fleet-rollout-checklist.md)

For issues and questions, refer to the project repository or contact the IT team.
