#!/bin/bash
#
# ITMS Pre-commit Hook - Credential Scanner
# Prevents committing files with exposed credentials
#
# Installation:
#   cp scripts/pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Scanning for exposed credentials..."

# Patterns that should never be committed
DANGEROUS_PATTERNS=(
    "password\s*=\s*['\"][^'\"]{3,}"
    "PASSWORD\s*=\s*['\"][^'\"]{3,}"
    "secret\s*=\s*['\"][^'\"]{3,}"
    "SECRET\s*=\s*['\"][^'\"]{3,}"
    "api[_-]?key\s*=\s*['\"][^'\"]{10,}"
    "API[_-]?KEY\s*=\s*['\"][^'\"]{10,}"
    "token\s*=\s*['\"][^'\"]{10,}"
    "TOKEN\s*=\s*['\"][^'\"]{10,}"
    "postgres://[^:]+:[^@]+@"
    "mysql://[^:]+:[^@]+@"
    "mongodb://[^:]+:[^@]+@"
    "PRIVATE[_\s]KEY"
    "BEGIN RSA PRIVATE KEY"
    "BEGIN OPENSSH PRIVATE KEY"
    "AWS_SECRET_ACCESS_KEY"
    "AKIA[0-9A-Z]{16}"
)

# Files that should never be committed
DANGEROUS_FILENAMES=(
    ".env"
    ".env.local"
    ".env.secrets"
    "*.pem"
    "*.key"
    "*password*"
    "*credential*"
    "*secret*"
    "id_rsa"
    "id_ed25519"
    "*.pfx"
    "*.p12"
)

FOUND_ISSUES=0

# Check filenames
for pattern in "${DANGEROUS_FILENAMES[@]}"; do
    files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "$pattern" | grep -v ".example" | grep -v ".gitignore" || true)
    if [ ! -z "$files" ]; then
        echo -e "${RED}❌ BLOCKED: Attempting to commit sensitive file(s):${NC}"
        echo "$files"
        FOUND_ISSUES=1
    fi
done

# Check file contents
for file in $(git diff --cached --name-only --diff-filter=ACM); do
    # Skip binary files
    if git diff --cached --numstat "$file" | grep -q "^-"; then
        continue
    fi
    
    # Get the staged content
    content=$(git diff --cached "$file")
    
    for pattern in "${DANGEROUS_PATTERNS[@]}"; do
        if echo "$content" | grep -qiE "$pattern"; then
            if [ $FOUND_ISSUES -eq 0 ]; then
                echo -e "${RED}❌ BLOCKED: Potential credentials found in file: $file${NC}"
                FOUND_ISSUES=1
            else
                echo -e "${RED}   Also in: $file${NC}"
            fi
            break
        fi
    done
done

# Check for files with command-like names (like the incident we just fixed)
command_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "(psql|mysql|mongo|redis-cli|curl|wget)\s+" || true)
if [ ! -z "$command_files" ]; then
    echo -e "${RED}❌ BLOCKED: Files with command-like names:${NC}"
    echo "$command_files"
    echo -e "${YELLOW}⚠️  This looks like a shell command saved as a filename${NC}"
    FOUND_ISSUES=1
fi

if [ $FOUND_ISSUES -eq 1 ]; then
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  COMMIT BLOCKED: Potential credentials or secrets found   ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "To fix this:"
    echo "  1. Remove sensitive data from the files"
    echo "  2. Add sensitive files to .gitignore"
    echo "  3. Use environment variables or secrets management"
    echo ""
    echo "If this is a false positive, you can bypass with:"
    echo "  git commit --no-verify"
    echo ""
    exit 1
fi

echo "✅ No exposed credentials detected"
exit 0
