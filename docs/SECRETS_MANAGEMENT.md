# Secrets Management Guide

## Overview

ITMS uses a multi-layered approach to secrets management to ensure credentials are never exposed in the repository.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Setup](#development-setup)
3. [Production Deployment](#production-deployment)
4. [Secrets Rotation](#secrets-rotation)
5. [Emergency Procedures](#emergency-procedures)

---

## Quick Start

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/Mohdgani-vibe/itms-ghani.git
cd itms-ghani

# 2. Install pre-commit hook (prevents credential leaks)
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# 3. Set up secrets for local development
./scripts/setup-secrets.sh
```

## Development Setup

### Using Environment Variables (Development)

For local development, use `.env` files (never commit these!):

```bash
# backend/.env
DATABASE_URL=postgres://postgres:your_dev_password@localhost:5432/itms?sslmode=disable
JWT_SECRET=your_dev_jwt_secret_here
SALT_API_TOKEN=your_dev_salt_token
```

**✅ Safe:**
- `.env` is in `.gitignore`
- Pre-commit hook blocks `.env` files
- Use weak passwords in development (never production passwords)

**❌ Never:**
- Commit `.env` files
- Use production credentials locally
- Share credentials via chat/email

### Using Docker Secrets (Recommended)

For development that mirrors production:

```bash
# 1. Generate secrets
./scripts/setup-secrets.sh

# 2. Start with Docker secrets
cd backend
docker compose -f docker-compose.production.yml up -d
```

---

## Production Deployment

### Option 1: Docker Secrets (Recommended)

**Best for:** Docker Swarm, single-host deployments

```bash
# 1. Create secrets directory
mkdir -p backend/secrets
chmod 700 backend/secrets

# 2. Create secret files (use strong passwords!)
echo "$(openssl rand -hex 64)" > backend/secrets/jwt_secret.txt
echo "your_strong_postgres_password" > backend/secrets/postgres_password.txt
echo "your_salt_api_token" > backend/secrets/salt_api_token.txt

# 3. Set permissions
chmod 600 backend/secrets/*.txt

# 4. Deploy
docker compose -f backend/docker-compose.production.yml up -d
```

### Option 2: HashiCorp Vault

**Best for:** Large deployments, multi-service environments

```bash
# Install Vault
vault server -dev

# Store secrets
vault kv put secret/itms/database \
  username=postgres \
  password=your_password

vault kv put secret/itms/jwt \
  secret=your_jwt_secret

# Application reads from Vault at runtime
export VAULT_ADDR='http://127.0.0.1:8200'
export VAULT_TOKEN='your_token'
```

### Option 3: AWS Secrets Manager

**Best for:** AWS deployments

```bash
# Store secrets in AWS
aws secretsmanager create-secret \
  --name itms/database/password \
  --secret-string "your_strong_password"

aws secretsmanager create-secret \
  --name itms/jwt/secret \
  --secret-string "$(openssl rand -hex 64)"

# Grant IAM permissions to EC2/ECS
# Application reads secrets at startup
```

### Option 4: Kubernetes Secrets

**Best for:** Kubernetes deployments

```bash
# Create secrets in Kubernetes
kubectl create secret generic itms-db-secret \
  --from-literal=password='your_strong_password'

kubectl create secret generic itms-jwt-secret \
  --from-literal=secret="$(openssl rand -hex 64)"

# Reference in deployment
# See: docs/kubernetes-deployment.md
```

---

## Secrets Rotation

### When to Rotate

- **Immediately:** After suspected compromise
- **Quarterly:** Regular scheduled rotation
- **Annually:** Minimum requirement
- **After:** Employee offboarding with access

### Database Password Rotation

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -hex 32)

# 2. Change in database
docker exec itms-postgres psql -U postgres -d itms -c \
  "ALTER USER postgres WITH PASSWORD '$NEW_PASSWORD';"

# 3. Update secret file
echo "$NEW_PASSWORD" > backend/secrets/postgres_password.txt

# 4. Restart backend
docker compose -f backend/docker-compose.production.yml restart backend

# 5. Verify
docker logs itms-backend --tail 50
```

### JWT Secret Rotation

```bash
# 1. Generate new JWT secret
openssl rand -hex 64 > backend/secrets/jwt_secret.txt

# 2. Restart backend (existing tokens become invalid)
docker compose -f backend/docker-compose.production.yml restart backend

# Note: All users will need to log in again
```

---

## Emergency Procedures

### Credential Leak Detected

**Immediate Actions (within 15 minutes):**

1. **Rotate Compromised Credentials**
   ```bash
   # Database
   docker exec itms-postgres psql -U postgres -d itms -c \
     "ALTER USER postgres WITH PASSWORD 'NEW_STRONG_PASSWORD';"
   
   # Update config and restart
   echo "NEW_STRONG_PASSWORD" > backend/secrets/postgres_password.txt
   docker compose restart backend
   ```

2. **Remove from Git History**
   ```bash
   # If credentials are in git history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/leaked/file" \
     --prune-empty --tag-name-filter cat -- --all
   
   git push origin --force --all
   ```

3. **Check Access Logs**
   ```bash
   # Check database logs for unauthorized access
   docker exec itms-postgres psql -U postgres -d itms -c \
     "SELECT * FROM pg_stat_activity;"
   ```

4. **Notify Team**
   - Inform all developers
   - Update incident log
   - Review security procedures

### Lockout Recovery

If you lose access to secrets:

1. **Database Recovery**
   ```bash
   # If you have database backups
   docker exec itms-postgres psql -U postgres -c \
     "ALTER USER postgres WITH PASSWORD 'new_password';"
   ```

2. **JWT Recovery**
   ```bash
   # Generate new JWT secret (invalidates all sessions)
   openssl rand -hex 64 > backend/secrets/jwt_secret.txt
   docker compose restart backend
   ```

---

## Security Checklist

### Before Every Commit

- [ ] Run: `git status` - check for sensitive files
- [ ] Pre-commit hook is installed and executable
- [ ] No `.env` files in staging area
- [ ] No passwords in code or config files

### Before Every Deployment

- [ ] All secrets use strong, random passwords (64+ chars)
- [ ] Secrets stored in secure backend (Vault/AWS/Docker Secrets)
- [ ] No secrets in environment variables (visible in `docker inspect`)
- [ ] Database backups encrypted
- [ ] Access logs reviewed

### Monthly

- [ ] Review access to secrets
- [ ] Audit security logs
- [ ] Check for dependency vulnerabilities
- [ ] Review GitHub Security alerts

### Quarterly

- [ ] Rotate all credentials
- [ ] Security training for team
- [ ] Review and update security procedures
- [ ] Penetration testing

---

## Tools & Resources

### Scanning Tools

- **TruffleHog**: `docker run --rm -it -v "$PWD:/pwd" trufflesecurity/trufflehog:latest filesystem /pwd`
- **Gitleaks**: `docker run --rm -v $(pwd):/repo zricethezav/gitleaks:latest detect --source="/repo"`
- **git-secrets**: `git secrets --scan`

### Password Generation

```bash
# Strong password (32 bytes = 64 hex chars)
openssl rand -hex 32

# Very strong (64 bytes = 128 hex chars)
openssl rand -hex 64

# Base64 encoded
openssl rand -base64 48
```

### Secure File Deletion

```bash
# Securely delete a file
shred -u sensitive_file.txt

# Secure delete on macOS
rm -P sensitive_file.txt
```

---

## Contact

For security incidents or questions:

- **Security Lead**: [Your Name]
- **Emergency**: [Emergency Contact]
- **Email**: security@your-domain.com

**Report vulnerabilities to**: security@your-domain.com

---

## Additional Resources

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [HashiCorp Vault Tutorial](https://learn.hashicorp.com/vault)
