#!/bin/bash
# Security Monitoring Script for ITMS
# Monitors rate limiting, suspicious patterns, auth lockouts, and CORS violations
# Usage: ./security-monitor.sh [--watch] [--hours=24]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
WATCH_MODE=false
HOURS=24
NGINX_ERROR_LOG="/var/log/nginx/error.log"
NGINX_ACCESS_LOG="/var/log/nginx/access.log"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --watch)
            WATCH_MODE=true
            shift
            ;;
        --hours=*)
            HOURS="${arg#*=}"
            shift
            ;;
        --help)
            echo "Usage: $0 [--watch] [--hours=24]"
            echo "  --watch       Run in continuous watch mode (refreshes every 30 seconds)"
            echo "  --hours=N     Look back N hours (default: 24)"
            exit 0
            ;;
    esac
done

# Check if running as root or with sudo (needed for log access)
if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    echo -e "${YELLOW}Warning: This script needs sudo access to read nginx logs${NC}"
    echo "Run with: sudo $0 $@"
    exit 1
fi

# Function to display header
display_header() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}          ITMS Security Monitoring Dashboard                       ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}          Last ${HOURS} hours - $(date '+%Y-%m-%d %H:%M:%S')                     ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Function to check nginx rate limiting
check_rate_limiting() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📊 nginx Rate Limiting Events${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ ! -f "$NGINX_ERROR_LOG" ]]; then
        echo -e "${YELLOW}⚠️  nginx error log not found: $NGINX_ERROR_LOG${NC}"
        echo ""
        return
    fi
    
    # Count rate limit events by zone
    local auth_limit_count=$(sudo grep "limiting requests.*auth_limit" "$NGINX_ERROR_LOG" 2>/dev/null | wc -l || echo "0")
    local api_limit_count=$(sudo grep "limiting requests.*api_limit" "$NGINX_ERROR_LOG" 2>/dev/null | wc -l || echo "0")
    local general_limit_count=$(sudo grep "limiting requests.*general_limit" "$NGINX_ERROR_LOG" 2>/dev/null | wc -l || echo "0")
    local conn_limit_count=$(sudo grep "limiting connections.*conn_limit" "$NGINX_ERROR_LOG" 2>/dev/null | wc -l || echo "0")
    
    local total_limit=$((auth_limit_count + api_limit_count + general_limit_count + conn_limit_count))
    
    if [[ $total_limit -eq 0 ]]; then
        echo -e "${GREEN}✅ No rate limiting events (system healthy)${NC}"
    else
        if [[ $total_limit -gt 100 ]]; then
            echo -e "${RED}🚨 CRITICAL: High rate limiting activity detected!${NC}"
        else
            echo -e "${YELLOW}⚠️  Rate limiting events detected${NC}"
        fi
        echo ""
        echo "  Auth endpoints:    $auth_limit_count events"
        echo "  API endpoints:     $api_limit_count events"
        echo "  General traffic:   $general_limit_count events"
        echo "  Connection limits: $conn_limit_count events"
        echo "  ────────────────────────────────"
        echo "  Total:             $total_limit events"
        
        # Top 5 IPs hitting rate limits
        echo ""
        echo -e "${YELLOW}Top 5 IPs hitting rate limits:${NC}"
        sudo grep "limiting requests" "$NGINX_ERROR_LOG" 2>/dev/null | \
            grep -oP 'client: \K[0-9.]+' | \
            sort | uniq -c | sort -rn | head -5 | \
            awk '{printf "  %-5s %s\n", $1"x", $2}' || echo "  None found"
    fi
    echo ""
}

# Function to check request size rejections
check_request_size() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📦 Request Size Rejections (HTTP 413)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ ! -f "$NGINX_ACCESS_LOG" ]]; then
        echo -e "${YELLOW}⚠️  nginx access log not found: $NGINX_ACCESS_LOG${NC}"
        echo ""
        return
    fi
    
    local rejection_count=$(sudo grep " 413 " "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l || echo "0")
    
    if [[ $rejection_count -eq 0 ]]; then
        echo -e "${GREEN}✅ No request size rejections${NC}"
    else
        echo -e "${YELLOW}⚠️  $rejection_count request(s) rejected (body too large)${NC}"
        echo ""
        echo -e "${YELLOW}Top 5 IPs with size rejections:${NC}"
        sudo grep " 413 " "$NGINX_ACCESS_LOG" 2>/dev/null | \
            awk '{print $1}' | sort | uniq -c | sort -rn | head -5 | \
            awk '{printf "  %-5s %s\n", $1"x", $2}' || echo "  None found"
    fi
    echo ""
}

# Function to check CORS violations
check_cors_violations() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🌐 CORS Violations (HTTP 403 on API)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ ! -f "$NGINX_ACCESS_LOG" ]]; then
        echo -e "${YELLOW}⚠️  nginx access log not found: $NGINX_ACCESS_LOG${NC}"
        echo ""
        return
    fi
    
    local cors_count=$(sudo grep " 403 " "$NGINX_ACCESS_LOG" 2>/dev/null | grep "/api/" | wc -l || echo "0")
    
    if [[ $cors_count -eq 0 ]]; then
        echo -e "${GREEN}✅ No CORS violations${NC}"
    else
        echo -e "${YELLOW}⚠️  $cors_count potential CORS violation(s)${NC}"
        echo ""
        echo -e "${YELLOW}Top 5 IPs with CORS violations:${NC}"
        sudo grep " 403 " "$NGINX_ACCESS_LOG" 2>/dev/null | grep "/api/" | \
            awk '{print $1}' | sort | uniq -c | sort -rn | head -5 | \
            awk '{printf "  %-5s %s\n", $1"x", $2}' || echo "  None found"
    fi
    echo ""
}

# Function to check database audit log (requires PostgreSQL connection)
check_audit_log() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}🔍 Database Audit Log (Suspicious Patterns & Auth Lockouts)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Try to connect to database (adjust connection details as needed)
    local DB_HOST="${POSTGRES_HOST:-localhost}"
    local DB_PORT="${POSTGRES_PORT:-5432}"
    local DB_NAME="${POSTGRES_DB:-itms}"
    local DB_USER="${POSTGRES_USER:-postgres}"
    
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠️  psql not found - skipping database checks${NC}"
        echo "   Install with: sudo apt install postgresql-client"
        echo ""
        return
    fi
    
    # Suspicious pattern detections
    local suspicious_query="SELECT COUNT(*) FROM audit_log WHERE action LIKE 'suspicious_pattern_%' AND created_at > NOW() - INTERVAL '$HOURS hours';"
    local suspicious_count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$suspicious_query" 2>/dev/null | tr -d ' ' || echo "N/A")
    
    if [[ "$suspicious_count" == "N/A" ]]; then
        echo -e "${YELLOW}⚠️  Cannot connect to database - check credentials${NC}"
        echo ""
        return
    fi
    
    if [[ "$suspicious_count" -eq 0 ]]; then
        echo -e "${GREEN}✅ No suspicious patterns detected${NC}"
    else
        echo -e "${RED}🚨 $suspicious_count suspicious pattern(s) detected!${NC}"
        echo ""
        echo -e "${YELLOW}Top patterns:${NC}"
        local pattern_query="SELECT detail->>'pattern' as pattern, COUNT(*) as count FROM audit_log WHERE action LIKE 'suspicious_pattern_%' AND created_at > NOW() - INTERVAL '$HOURS hours' GROUP BY detail->>'pattern' ORDER BY count DESC LIMIT 5;"
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$pattern_query" 2>/dev/null | \
            sed 's/^/  /' || echo "  Query failed"
    fi
    
    echo ""
    
    # Auth lockouts
    local lockout_query="SELECT COUNT(DISTINCT detail->>'ip') FROM audit_log WHERE action = 'auth_too_many_attempts' AND created_at > NOW() - INTERVAL '$HOURS hours';"
    local lockout_count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$lockout_query" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [[ "$lockout_count" -eq 0 ]]; then
        echo -e "${GREEN}✅ No auth lockouts${NC}"
    else
        echo -e "${YELLOW}⚠️  $lockout_count IP(s) locked out for failed login attempts${NC}"
        echo ""
        echo -e "${YELLOW}Top IPs locked out:${NC}"
        local lockout_ip_query="SELECT detail->>'ip' as ip, COUNT(*) as lockouts FROM audit_log WHERE action = 'auth_too_many_attempts' AND created_at > NOW() - INTERVAL '$HOURS hours' GROUP BY detail->>'ip' ORDER BY lockouts DESC LIMIT 5;"
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$lockout_ip_query" 2>/dev/null | \
            sed 's/^/  /' || echo "  Query failed"
    fi
    echo ""
}

# Function to display summary
display_summary() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📋 Security Summary${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Monitoring active${NC}"
    echo "   Log files: $NGINX_ERROR_LOG, $NGINX_ACCESS_LOG"
    echo "   Lookback period: $HOURS hours"
    
    if [[ "$WATCH_MODE" == true ]]; then
        echo ""
        echo -e "${YELLOW}Press Ctrl+C to exit watch mode${NC}"
    fi
    echo ""
}

# Main monitoring function
run_monitoring() {
    display_header
    check_rate_limiting
    check_request_size
    check_cors_violations
    check_audit_log
    display_summary
}

# Main execution
if [[ "$WATCH_MODE" == true ]]; then
    while true; do
        run_monitoring
        sleep 30
    done
else
    run_monitoring
fi
