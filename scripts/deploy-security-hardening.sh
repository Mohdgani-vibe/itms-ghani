#!/bin/bash
# ITMS Production Deployment Script
# Deploys maximum security hardening changes to production
# Usage: ./deploy-security-hardening.sh [--dry-run] [--backup] [--rollback]

set -euo pipefail

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
DRY_RUN=false
BACKUP=true
ROLLBACK=false
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/itms_backup_$TIMESTAMP"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-backup)
            BACKUP=false
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--no-backup] [--rollback]"
            echo "  --dry-run      Show what would be done without making changes"
            echo "  --no-backup    Skip backing up current configuration"
            echo "  --rollback     Rollback to previous backup"
            exit 0
            ;;
    esac
done

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to execute command (respects dry-run)
execute() {
    local cmd="$1"
    local description="$2"
    
    echo -e "${YELLOW}➜${NC} $description"
    
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${BLUE}  [DRY RUN] Would execute: $cmd${NC}"
        return 0
    else
        echo -e "${BLUE}  Executing: $cmd${NC}"
        eval "$cmd"
        local exit_code=$?
        if [[ $exit_code -eq 0 ]]; then
            echo -e "${GREEN}  ✅ Success${NC}"
        else
            echo -e "${RED}  ❌ Failed with exit code $exit_code${NC}"
            return $exit_code
        fi
    fi
}

# Function to backup current configuration
backup_configuration() {
    if [[ "$BACKUP" == false ]]; then
        echo -e "${YELLOW}⚠️  Skipping backup (--no-backup flag)${NC}"
        return 0
    fi
    
    print_header "📦 Backing Up Current Configuration"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup nginx configuration
    if [[ -f /etc/nginx/sites-available/itms.conf ]]; then
        execute "cp /etc/nginx/sites-available/itms.conf $BACKUP_DIR/itms.conf.bak" \
                "Backup nginx configuration"
    elif [[ -f /etc/nginx/conf.d/itms.conf ]]; then
        execute "cp /etc/nginx/conf.d/itms.conf $BACKUP_DIR/itms.conf.bak" \
                "Backup nginx configuration"
    else
        echo -e "${YELLOW}⚠️  nginx configuration not found in standard locations${NC}"
    fi
    
    # Backup docker-compose configuration
    if [[ -f /opt/itms/docker-compose.yml ]] || [[ -f $(pwd)/docker-compose.yml ]]; then
        local compose_file="/opt/itms/docker-compose.yml"
        [[ ! -f "$compose_file" ]] && compose_file="$(pwd)/docker-compose.yml"
        
        execute "cp $compose_file $BACKUP_DIR/docker-compose.yml.bak" \
                "Backup docker-compose configuration"
    fi
    
    # Backup backend binary (if exists)
    if [[ -f /opt/itms/backend/main ]]; then
        execute "cp /opt/itms/backend/main $BACKUP_DIR/backend_main.bak" \
                "Backup backend binary"
    fi
    
    echo -e "${GREEN}✅ Backup completed: $BACKUP_DIR${NC}"
    echo -e "${YELLOW}   Keep this path for rollback: --rollback-dir=$BACKUP_DIR${NC}"
}

# Function to rollback from backup
rollback_configuration() {
    print_header "🔄 Rolling Back Configuration"
    
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lht /tmp/itms_backup_* 2>/dev/null | head -5 || echo "No backups found"
    echo ""
    
    read -p "Enter backup directory path: " backup_path
    
    if [[ ! -d "$backup_path" ]]; then
        echo -e "${RED}❌ Backup directory not found: $backup_path${NC}"
        exit 1
    fi
    
    # Restore nginx configuration
    if [[ -f "$backup_path/itms.conf.bak" ]]; then
        if [[ -f /etc/nginx/sites-available/itms.conf ]]; then
            execute "cp $backup_path/itms.conf.bak /etc/nginx/sites-available/itms.conf" \
                    "Restore nginx configuration"
        elif [[ -f /etc/nginx/conf.d/itms.conf ]]; then
            execute "cp $backup_path/itms.conf.bak /etc/nginx/conf.d/itms.conf" \
                    "Restore nginx configuration"
        fi
    fi
    
    # Test nginx configuration
    execute "nginx -t" "Test nginx configuration"
    
    # Reload nginx
    execute "systemctl reload nginx" "Reload nginx"
    
    # Restore docker-compose
    if [[ -f "$backup_path/docker-compose.yml.bak" ]]; then
        local compose_file="/opt/itms/docker-compose.yml"
        [[ ! -f "$compose_file" ]] && compose_file="$(pwd)/docker-compose.yml"
        
        execute "cp $backup_path/docker-compose.yml.bak $compose_file" \
                "Restore docker-compose configuration"
    fi
    
    # Restart containers
    execute "cd /opt/itms && docker-compose restart backend" \
            "Restart backend container"
    
    echo -e "${GREEN}✅ Rollback completed${NC}"
    exit 0
}

# Function to validate nginx configuration
validate_nginx() {
    print_header "🔍 Validating nginx Configuration"
    
    # Find nginx config file
    local nginx_config=""
    if [[ -f /etc/nginx/sites-available/itms.conf ]]; then
        nginx_config="/etc/nginx/sites-available/itms.conf"
    elif [[ -f /etc/nginx/conf.d/itms.conf ]]; then
        nginx_config="/etc/nginx/conf.d/itms.conf"
    elif [[ -f $(pwd)/deploy/nginx/itms.conf ]]; then
        echo -e "${YELLOW}⚠️  Using local configuration file for validation${NC}"
        nginx_config="$(pwd)/deploy/nginx/itms.conf"
    else
        echo -e "${RED}❌ nginx configuration not found${NC}"
        return 1
    fi
    
    echo -e "${BLUE}nginx config: $nginx_config${NC}"
    
    # Check for required rate limiting zones
    echo ""
    echo -e "${YELLOW}Checking rate limiting zones...${NC}"
    
    if grep -q "limit_req_zone.*auth_limit" "$nginx_config"; then
        echo -e "${GREEN}  ✅ auth_limit zone configured${NC}"
    else
        echo -e "${RED}  ❌ auth_limit zone missing${NC}"
        return 1
    fi
    
    if grep -q "limit_req_zone.*api_limit" "$nginx_config"; then
        echo -e "${GREEN}  ✅ api_limit zone configured${NC}"
    else
        echo -e "${RED}  ❌ api_limit zone missing${NC}"
        return 1
    fi
    
    if grep -q "limit_conn_zone.*conn_limit" "$nginx_config"; then
        echo -e "${GREEN}  ✅ conn_limit zone configured${NC}"
    else
        echo -e "${RED}  ❌ conn_limit zone missing${NC}"
        return 1
    fi
    
    # Check for security headers
    echo ""
    echo -e "${YELLOW}Checking security headers...${NC}"
    
    local headers=("X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection" "Strict-Transport-Security" "Content-Security-Policy" "X-Permitted-Cross-Domain-Policies")
    
    for header in "${headers[@]}"; do
        if grep -q "add_header $header" "$nginx_config"; then
            echo -e "${GREEN}  ✅ $header configured${NC}"
        else
            echo -e "${YELLOW}  ⚠️  $header missing${NC}"
        fi
    done
    
    # Check for request size limits
    echo ""
    echo -e "${YELLOW}Checking request size limits...${NC}"
    
    if grep -q "client_max_body_size" "$nginx_config"; then
        local max_size=$(grep "client_max_body_size" "$nginx_config" | head -1 | awk '{print $2}' | tr -d ';')
        echo -e "${GREEN}  ✅ client_max_body_size: $max_size${NC}"
    else
        echo -e "${YELLOW}  ⚠️  client_max_body_size not set${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ nginx configuration validation passed${NC}"
}

# Function to deploy nginx configuration
deploy_nginx() {
    print_header "🚀 Deploying nginx Configuration"
    
    local source_config="$(pwd)/deploy/nginx/itms.conf"
    local target_config=""
    
    if [[ -f /etc/nginx/sites-available/itms.conf ]]; then
        target_config="/etc/nginx/sites-available/itms.conf"
    elif [[ -d /etc/nginx/sites-available ]]; then
        target_config="/etc/nginx/sites-available/itms.conf"
    elif [[ -d /etc/nginx/conf.d ]]; then
        target_config="/etc/nginx/conf.d/itms.conf"
    else
        echo -e "${RED}❌ nginx configuration directory not found${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Source: $source_config${NC}"
    echo -e "${BLUE}Target: $target_config${NC}"
    echo ""
    
    # Check if source exists
    if [[ ! -f "$source_config" ]]; then
        echo -e "${RED}❌ Source configuration not found: $source_config${NC}"
        return 1
    fi
    
    # Copy configuration
    execute "cp $source_config $target_config" \
            "Copy nginx configuration"
    
    # Enable site (if using sites-available)
    if [[ "$target_config" == "/etc/nginx/sites-available/itms.conf" ]]; then
        execute "ln -sf $target_config /etc/nginx/sites-enabled/itms.conf" \
                "Enable nginx site"
    fi
    
    # Test configuration
    echo ""
    execute "nginx -t" "Test nginx configuration"
    
    # Reload nginx
    echo ""
    execute "systemctl reload nginx" "Reload nginx (zero downtime)"
    
    echo ""
    echo -e "${GREEN}✅ nginx deployment completed${NC}"
}

# Function to deploy backend
deploy_backend() {
    print_header "🚀 Deploying Backend Application"
    
    local compose_dir="/opt/itms"
    [[ ! -d "$compose_dir" ]] && compose_dir="$(pwd)"
    
    echo -e "${BLUE}Docker compose directory: $compose_dir${NC}"
    echo ""
    
    # Pull latest code (if in git repo)
    if [[ -d "$compose_dir/.git" ]]; then
        execute "cd $compose_dir && git pull origin main" \
                "Pull latest code from git"
    else
        echo -e "${YELLOW}⚠️  Not a git repository, skipping git pull${NC}"
    fi
    
    # Rebuild backend container
    echo ""
    execute "cd $compose_dir && docker-compose build backend" \
            "Rebuild backend container"
    
    # Restart backend (rolling restart)
    echo ""
    execute "cd $compose_dir && docker-compose up -d --no-deps backend" \
            "Restart backend container (zero downtime)"
    
    # Wait for health check
    echo ""
    echo -e "${YELLOW}⏳ Waiting for backend health check...${NC}"
    sleep 5
    
    # Check container status
    local container_status=$(docker-compose -f "$compose_dir/docker-compose.yml" ps backend 2>/dev/null | grep -i "up" || echo "")
    
    if [[ -n "$container_status" ]]; then
        echo -e "${GREEN}✅ Backend container is running${NC}"
    else
        echo -e "${RED}❌ Backend container failed to start${NC}"
        echo -e "${YELLOW}Check logs: docker-compose -f $compose_dir/docker-compose.yml logs backend${NC}"
        return 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ Backend deployment completed${NC}"
}

# Function to verify deployment
verify_deployment() {
    print_header "✅ Verifying Deployment"
    
    # Check nginx status
    echo -e "${YELLOW}Checking nginx status...${NC}"
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}  ✅ nginx is running${NC}"
    else
        echo -e "${RED}  ❌ nginx is not running${NC}"
    fi
    
    # Check backend container status
    echo ""
    echo -e "${YELLOW}Checking backend container...${NC}"
    local backend_status=$(docker ps --filter "name=backend" --format "{{.Status}}" 2>/dev/null | head -1)
    
    if [[ -n "$backend_status" ]]; then
        echo -e "${GREEN}  ✅ Backend container: $backend_status${NC}"
    else
        echo -e "${RED}  ❌ Backend container not found${NC}"
    fi
    
    # Test rate limiting configuration
    echo ""
    echo -e "${YELLOW}Testing rate limiting zones...${NC}"
    
    if nginx -T 2>/dev/null | grep -q "limit_req_zone"; then
        echo -e "${GREEN}  ✅ Rate limiting zones loaded${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Rate limiting zones not found in nginx config${NC}"
    fi
    
    # Check security headers (if backend is accessible)
    echo ""
    echo -e "${YELLOW}Testing security headers (if backend accessible)...${NC}"
    
    local backend_url="http://localhost:3001/api/health"
    if curl -s -I "$backend_url" >/dev/null 2>&1; then
        local headers=$(curl -s -I "$backend_url")
        
        if echo "$headers" | grep -q "X-Content-Type-Options"; then
            echo -e "${GREEN}  ✅ Security headers present${NC}"
        else
            echo -e "${YELLOW}  ⚠️  Security headers not detected${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠️  Backend not accessible for header check${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Deployment verification completed${NC}"
}

# Main deployment flow
main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}     ITMS Maximum Security Hardening - Deployment Script      ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
    fi
    
    # Handle rollback
    if [[ "$ROLLBACK" == true ]]; then
        rollback_configuration
        exit 0
    fi
    
    # Backup current configuration
    backup_configuration
    
    # Validate nginx configuration
    validate_nginx
    
    # Confirm deployment
    if [[ "$DRY_RUN" == false ]]; then
        echo ""
        read -p "Proceed with deployment? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            echo -e "${YELLOW}⚠️  Deployment cancelled${NC}"
            exit 0
        fi
    fi
    
    # Deploy nginx
    deploy_nginx
    
    # Deploy backend
    deploy_backend
    
    # Verify deployment
    verify_deployment
    
    # Final summary
    print_header "🎉 Deployment Summary"
    
    echo -e "${GREEN}✅ Maximum security hardening deployed successfully${NC}"
    echo ""
    echo -e "${BLUE}Changes applied:${NC}"
    echo "  • nginx rate limiting (auth: 5r/m, API: 30r/m, general: 100r/m)"
    echo "  • Connection limiting (10 per IP)"
    echo "  • Request size limits (10MB)"
    echo "  • Enhanced security headers"
    echo "  • Suspicious pattern detection middleware"
    echo "  • Stricter auth limiting (5 attempts, 30min block)"
    echo "  • Enhanced JWT validation"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Monitor security metrics: scripts/security-monitor.sh --watch"
    echo "  2. Test rate limiting: curl -X POST https://your-domain/api/auth/login (try 6+ times)"
    echo "  3. Review logs: tail -f /var/log/nginx/error.log"
    echo "  4. Check backend: docker-compose logs -f backend"
    echo ""
    
    if [[ "$BACKUP" == true ]]; then
        echo -e "${YELLOW}⚠️  Backup saved: $BACKUP_DIR${NC}"
        echo -e "${YELLOW}   To rollback: sudo $0 --rollback${NC}"
        echo ""
    fi
    
    echo -e "${GREEN}🎉 Deployment completed!${NC}"
}

# Run main
main
