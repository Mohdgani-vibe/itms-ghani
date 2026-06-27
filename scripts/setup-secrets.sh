#!/bin/bash
#
# ITMS Secrets Setup Script
# Creates secure secrets directory and generates random secrets
#

set -e

SECRETS_DIR="./backend/secrets"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔒 ITMS Secrets Management Setup"
echo "=================================="
echo ""

# Create secrets directory
if [ ! -d "$SECRETS_DIR" ]; then
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
    echo -e "${GREEN}✅ Created secrets directory: $SECRETS_DIR${NC}"
else
    echo -e "${YELLOW}⚠️  Secrets directory already exists${NC}"
fi

# Function to generate secret
generate_secret() {
    local secret_name=$1
    local secret_file="$SECRETS_DIR/${secret_name}.txt"
    
    if [ -f "$secret_file" ]; then
        echo -e "${YELLOW}⚠️  $secret_name already exists, skipping${NC}"
        return
    fi
    
    # Generate a strong random secret (64 bytes = 128 hex chars)
    openssl rand -hex 64 > "$secret_file"
    chmod 600 "$secret_file"
    echo -e "${GREEN}✅ Generated: $secret_name${NC}"
}

# Function to prompt for existing secret
prompt_secret() {
    local secret_name=$1
    local secret_file="$SECRETS_DIR/${secret_name}.txt"
    local description=$2
    
    if [ -f "$secret_file" ]; then
        echo -e "${YELLOW}⚠️  $secret_name already exists, skipping${NC}"
        return
    fi
    
    echo ""
    echo -e "${YELLOW}Enter $description:${NC}"
    read -s secret_value
    echo "$secret_value" > "$secret_file"
    chmod 600 "$secret_file"
    echo -e "${GREEN}✅ Saved: $secret_name${NC}"
}

echo ""
echo "Generating random secrets..."
echo "----------------------------"

# Generate secrets that should be random
generate_secret "jwt_secret"

echo ""
echo "Enter existing secrets (press Enter to skip)..."
echo "------------------------------------------------"

# Prompt for secrets that might already exist
prompt_secret "postgres_password" "PostgreSQL password (or generate new)"
prompt_secret "salt_api_token" "SaltStack API token (if you have one)"
prompt_secret "wazuh_api_password" "Wazuh API password (if you have one)"

echo ""
echo -e "${GREEN}✅ Secrets setup complete!${NC}"
echo ""
echo "Important:"
echo "  • Secrets are in: $SECRETS_DIR"
echo "  • Never commit this directory to git"
echo "  • Backup secrets securely (encrypted)"
echo "  • Rotate secrets periodically"
echo ""
echo "To use these secrets:"
echo "  docker compose -f backend/docker-compose.production.yml up -d"
echo ""

# Add to .gitignore if not already there
if ! grep -q "^backend/secrets/$" .gitignore 2>/dev/null; then
    echo "backend/secrets/" >> .gitignore
    echo -e "${GREEN}✅ Added secrets/ to .gitignore${NC}"
fi

# Create .gitignore in secrets directory
echo "*" > "$SECRETS_DIR/.gitignore"
echo "!.gitignore" >> "$SECRETS_DIR/.gitignore"

echo ""
echo "Next steps:"
echo "  1. Update backend/.env with non-sensitive config"
echo "  2. Test the setup: make test-secrets"
echo "  3. Deploy: make deploy-production"
echo ""
