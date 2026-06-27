# Security

## 🔒 Security Overview

ITMS takes security seriously. This document provides information about our security practices and how to report vulnerabilities.

## 📚 Security Documentation

- **[Secrets Management Guide](docs/SECRETS_MANAGEMENT.md)** - Complete guide to managing credentials
- **[Security Best Practices](docs/SECURITY_BEST_PRACTICES.md)** - Development and deployment guidelines
- **[Incident Response Log](./memories/security-incidents.md)** - Historical security incidents

## 🚀 Quick Start - Secure Setup

### 1. Install Security Tools

```bash
# Install pre-commit hook (prevents credential leaks)
make -f Makefile.security security-setup

# Or manually:
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 2. Set Up Secrets

```bash
# Generate secure secrets for development
make -f Makefile.security setup-secrets

# Or manually:
./scripts/setup-secrets.sh
```

### 3. Verify Security

```bash
# Run security scans
make -f Makefile.security security-scan

# Test pre-commit hook
make -f Makefile.security test-pre-commit
```

## 🛡️ Security Features

### Automated Protection

- ✅ **Pre-commit hooks** - Blocks commits with credentials
- ✅ **GitHub Actions** - Automated security scanning on every push
- ✅ **Dependency scanning** - Trivy, Dependabot alerts
- ✅ **Secret detection** - TruffleHog, Gitleaks integration
- ✅ **Docker secrets** - Production-ready secrets management

### Manual Security Tools

```bash
# Quick security check
make -f Makefile.security security-scan

# Deep scan with external tools
make -f Makefile.security security-scan-deep

# Generate security report
make -f Makefile.security security-report

# Audit database access
make -f Makefile.security audit-logs
```

## 🔐 Credential Management

### What NOT to Commit

❌ **Never commit these files:**
- `.env` files
- `secrets/` directory
- Private keys (`.pem`, `.key`)
- Database passwords
- API tokens
- JWT secrets

✅ **Safe to commit:**
- `.env.example` (template with no real values)
- `docker-compose.yml` (using environment variables)
- Configuration files (without secrets)

### Secrets Storage Options

**Development:**
- `.env` files (git-ignored)
- Docker secrets (for testing production setup)

**Production:**
- Docker Secrets (single-host deployments)
- HashiCorp Vault (recommended for multi-service)
- AWS Secrets Manager (AWS deployments)
- Kubernetes Secrets (K8s deployments)

See [Secrets Management Guide](docs/SECRETS_MANAGEMENT.md) for details.

## 🚨 Reporting Security Vulnerabilities

### For Internal Team

If you discover a security issue:

1. **DO NOT** commit the fix to a public branch
2. Create a [GitHub Security Advisory](https://github.com/Mohdgani-vibe/itms-ghani/security/advisories)
3. Tag it as `security` and `urgent`
4. Notify the security lead immediately

### For External Researchers

We welcome responsible disclosure of security vulnerabilities.

**Contact:**
- **Email**: security@your-domain.com
- **Response time**: Within 24 hours
- **PGP Key**: Available at `/.well-known/security.txt`

**What to include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Reward:**
- Acknowledgment in SECURITY.md (if desired)
- Hall of fame entry
- Potential bug bounty (depending on severity)

## 📋 Security Checklist

### Before Every Commit

- [ ] Pre-commit hook is installed: `ls -la .git/hooks/pre-commit`
- [ ] No secrets in staged files: `git diff --staged`
- [ ] No `.env` files staged: `git status`

### Before Every Deployment

- [ ] Secrets rotated (different from dev/staging)
- [ ] SSL/TLS certificates valid
- [ ] Firewall rules configured
- [ ] Backups automated and tested
- [ ] Monitoring configured
- [ ] Security scan passed: `make -f Makefile.security security-scan`

### Monthly Tasks

- [ ] Review security alerts (GitHub Security tab)
- [ ] Update dependencies: `npm audit fix`, `go get -u`
- [ ] Check audit logs: `make -f Makefile.security audit-logs`
- [ ] Review access permissions

### Quarterly Tasks

- [ ] Rotate all credentials: `make -f Makefile.security rotate-secrets`
- [ ] Security training
- [ ] Review and update security docs
- [ ] Penetration testing

## 🔄 Credential Rotation

### When to Rotate

- **Immediately**: After any suspected compromise
- **Quarterly**: Regular scheduled rotation
- **Annually**: Minimum requirement
- **After**: Employee offboarding with system access

### How to Rotate

```bash
# Automated rotation (with downtime)
make -f Makefile.security rotate-secrets

# Manual rotation
# See: docs/SECRETS_MANAGEMENT.md#secrets-rotation
```

## 📊 Security Metrics

### Current Status

- Pre-commit Hook: ✅ Installed
- GitHub Security Scanning: ✅ Enabled
- Dependency Scanning: ✅ Enabled via Dependabot
- Docker Secrets: ✅ Configured (production)
- Secret Detection: ✅ TruffleHog + Gitleaks
- Last Security Audit: 2026-06-27
- Last Credential Rotation: 2026-06-27

### Known Issues

Check the [GitHub Security Advisories](https://github.com/Mohdgani-vibe/itms-ghani/security/advisories) page for current security issues.

## 🏆 Hall of Fame

We thank the following individuals for responsibly disclosing security issues:

- *[No external reports yet]*

## 📞 Contact

**Security Team**
- **Lead**: [Your Name]
- **Email**: security@your-domain.com
- **Emergency**: [Emergency contact]

**For General Questions**
- Create an issue with the `security` label
- Email: security@your-domain.com

## 📖 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Go Security Checklist](https://github.com/Checkmarx/Go-SCP)

---

## Recent Security Incidents

### 2026-06-27: Exposed Database Credentials

**Status**: ✅ Resolved  
**Severity**: Critical  
**Duration**: 11 days (2026-06-16 to 2026-06-27)

**Summary**: A file containing database connection details was accidentally committed to the public repository. The file was removed from git history, credentials were rotated, and preventive measures were implemented.

**Resolution**:
- Credentials rotated
- File removed from git history
- GitHub history force-pushed
- Pre-commit hooks implemented
- Security documentation created
- Team training conducted

**Preventive Measures**:
- Pre-commit hooks for credential detection
- GitHub Actions security scanning
- Docker secrets for production
- Enhanced .gitignore patterns
- Security best practices documentation

See [full incident report](./memories/security-incidents.md) for details.

---

**Last Updated**: 2026-06-27  
**Version**: 1.0
