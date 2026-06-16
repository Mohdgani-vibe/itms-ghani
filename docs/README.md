# ITMS Documentation Index

Complete documentation for the IT Management System (ITMS).

## Quick Start Guides

- **[Installation Guide](../INSTALLATION.md)** - Full installation instructions for first-time setup
- **[Update Existing Server](update-existing-server.md)** - Update an existing ITMS installation
- **[Quick Reference](QUICK_REFERENCE.md)** - Cheat sheet for common tasks
- **[Password Reset Guide](password-reset-guide.md)** - How to reset user passwords
- **[Second Server Deployment](second-server-deployment-guide.md)** - Deploy ITMS to additional servers

## Core Features

### User Management
- [Password Reset Guide](password-reset-guide.md) - Reset passwords via UI or API
- [Employee Import](user-import-minimal-template.csv) - Bulk user import template
- [User Access Control](auditor-portal-access.md) - Portal access configuration

### Infrastructure Management
- [Device Management](device-detail.html) - Managing devices in ITMS
- [Asset Tracking](employee-assets-requests.html) - Employee asset requests
- [Inventory Sync](inventory-sync.md) - Automated inventory synchronization

### Security & Compliance
- [Security Design](fleet-ssh-salt-security-design.md) - SSH and Salt security architecture
- [OpenSCAP Compliance](salt-agent-states.md) - Security compliance scanning
- [Patch Management](patch-dashboard-department-groups-may2026.md) - Patch dashboard usage

### Communication & Alerts
- [Mattermost Integration](mattermost-chat-integration.md) - Chat system setup
- [Alert Dashboard](alerts-dashboard-api.md) - Real-time alert monitoring
- [Live Validation](live-validation-2026-05-13.md) - System validation logs

## Deployment & Operations

### Server Setup
- **[Second Server Deployment Guide](second-server-deployment-guide.md)** - Deploy to additional servers
- [New Server Installation](new-server-installation-guide.html) - Step-by-step server setup
- [Second Server Runbook Template](second-server-runbook-template.md) - Manual deployment template
- [Installation Checklist](new-server-installation-checklist.csv) - Deployment checklist

### Configuration
- [Backend Environment](../backend/README.md) - Backend configuration options
- [Frontend Build](../frontend/README.md) - Frontend build and deployment
- [Docker Compose](../backend/docker-compose.yml) - Container orchestration

### Maintenance
- [Release Notes](release-note-2026-04-22.md) - Latest release information
- [Deployment Handoff](deployment-handoff.md) - Production deployment guide
- [Release Hardening](release-hardening-summary-2026-04-22.md) - Security hardening steps

## Integrations

### SaltStack
- [Security Design](fleet-ssh-salt-security-design.md) - Salt security architecture
- [Agent States](salt-agent-states.md) - Salt minion configuration
- [Rollout Checklist](fleet-rollout-checklist.md) - Fleet deployment checklist

### Wazuh
- [Integration Setup](mattermost-implementation-plan.md) - Wazuh monitoring setup

### Mattermost
- [Chat Integration](mattermost-chat-integration.md) - Chat system integration
- [Implementation Plan](mattermost-implementation-plan.md) - Rollout strategy

## Development

### API Documentation
- [Backend API](../backend/README.md) - API endpoints and usage
- [Alerts API](alerts-dashboard-api.md) - Alert system API

### Scripts & Automation
- [Installation Scripts](../scripts/) - Automated installation scripts
- [Check Scripts](../scripts/check-itms-*.sh) - System verification scripts
- [Smoke Tests](../scripts/smoke-test-itms-*.sh) - API and system tests

### Database
- [PostgreSQL Setup](../backend/db/) - Database schema and migrations
- [Backup Script](backup.sql) - Database backup utilities

## Troubleshooting

### Common Issues
- **403 Forbidden** - Clear browser cache (Ctrl+Shift+R) or use incognito mode
- **Login Failed** - Verify credentials with password reset guide
- **Backend Down** - Check Docker logs: `docker logs zerodha-itms-backend`
- **Frontend Blank** - Rebuild and redeploy frontend

### Verification Scripts
```bash
# Check backend health
curl http://localhost:3001/api/health

# Check all integrations
bash scripts/check-itms-server-integrations.sh

# Run smoke tests
bash scripts/smoke-test-itms-api.sh
bash scripts/smoke-test-itms-nginx.sh

# Check OpenSCAP status
bash scripts/check-itms-openscap-status.sh

# Verify release readiness
bash scripts/check-itms-release-readiness.sh
```

## Administration

### User Management
- **[Password Reset](password-reset-guide.md)** - Reset user passwords (UI or API)
- **User Import** - Import users from CSV templates
- **Access Control** - Manage portal access and roles

### System Operations
- **[Server Deployment](second-server-deployment-guide.md)** - Deploy to new servers
- **Backup & Recovery** - Database backup procedures
- **Monitoring** - Health checks and alerts
- **Updates** - System upgrade procedures

## Security

### Best Practices
- Use strong passwords (12+ characters minimum)
- Rotate admin credentials regularly
- Enable SSL/TLS for production
- Configure firewall rules
- Regular security audits

### Hardening
- [Security Hardening](release-hardening-summary-2026-04-22.md) - Production hardening
- [SSH Security](fleet-ssh-salt-security-design.md) - SSH access control
- [Compliance Scanning](salt-agent-states.md) - OpenSCAP integration

## Quick Tasks

### Reset User Password
```bash
# Via UI: Login → Users → Select User → Reset Password
# Via API: See password-reset-guide.md
```

### Deploy to Second Server
```bash
# Generate deployment runbook
bash scripts/render-second-server-runbook.sh \
  --server-ip 172.10.80.20 \
  --prompt-admin-password \
  --prompt-jwt-secret \
  --output .run/deployment.md

# Deploy to server (follow runbook)
```

### Check System Health
```bash
# Backend health
curl http://localhost:3001/api/health

# Full system check
bash scripts/verify-itms-stack.sh --sudo
```

## Getting Help

### Documentation
- **Installation Issues:** See [INSTALLATION.md](../INSTALLATION.md)
- **Password Reset:** See [password-reset-guide.md](password-reset-guide.md)
- **Server Deployment:** See [second-server-deployment-guide.md](second-server-deployment-guide.md)
- **API Reference:** See [Backend README](../backend/README.md)

### Support Channels
- **GitHub Issues:** Report bugs and feature requests
- **Mattermost:** Internal team communication
- **Email:** Technical support contact

### Verification Tools
All scripts are located in the `scripts/` directory:
- `smoke-test-itms-api.sh` - Test API endpoints
- `smoke-test-itms-nginx.sh` - Test nginx configuration
- `check-itms-server-integrations.sh` - Verify integrations
- `verify-itms-stack.sh` - Complete system verification

---

## Document Index

### Core Documentation
- [INSTALLATION.md](../INSTALLATION.md) - Main installation guide
- [README.md](../README.md) - Project overview
- [Backend README](../backend/README.md) - Backend documentation
- [Frontend README](../frontend/README.md) - Frontend documentation

### Feature Guides
- [password-reset-guide.md](password-reset-guide.md) - **User password reset**
- [second-server-deployment-guide.md](second-server-deployment-guide.md) - **Multi-server deployment**
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - **Quick reference card**

### Operations
- [deployment-handoff.md](deployment-handoff.md) - Production deployment
- [fleet-rollout-checklist.md](fleet-rollout-checklist.md) - Rollout checklist
- [release-note-2026-04-22.md](release-note-2026-04-22.md) - Release notes

### Technical
- [alerts-dashboard-api.md](alerts-dashboard-api.md) - Alerts API
- [inventory-sync.md](inventory-sync.md) - Inventory sync
- [fleet-ssh-salt-security-design.md](fleet-ssh-salt-security-design.md) - Security design

---

**Last Updated:** 2026-06-16  
**Version:** 1.0  
**Maintainer:** ITMS Team
