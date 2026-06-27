#!/bin/bash
# Fix docker-compose.yml duplicate volumes issue
# Run this on production server: 172.10.80.16

cd /home/itms/itms/backend

echo "=== Backing up docker-compose.yml ==="
cp docker-compose.yml docker-compose.yml.backup

echo "=== Removing SSH volume mounts that cause duplicates ==="
sed -i '/^\s*- \${SSH_TERMINAL.*$/d' docker-compose.yml

echo "=== Validating docker-compose.yml ==="
if docker-compose config >/dev/null 2>&1; then
    echo "✅ docker-compose.yml is now valid"
else
    echo "❌ Still has errors - restoring backup"
    mv docker-compose.yml.backup docker-compose.yml
    exit 1
fi

echo "=== Rebuilding backend with inventory route fixes ==="
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d

echo "=== Waiting for backend to start (30 seconds) ==="
sleep 30

echo "=== Checking if inventory routes are registered ==="
docker logs zerodha-itms-backend 2>&1 | grep "GET.*inventory"

echo ""
echo "=== Testing inventory endpoint ==="
TOKEN=$(curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"muhammed.gani@zerodha.com","password":"Zer0dhA@2026"}' \
  -s | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])' 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo "Token obtained, testing endpoint..."
    curl -X GET "http://localhost/api/inventory/module/options" \
      -H "Authorization: Bearer $TOKEN" \
      -w "\nHTTP Status: %{http_code}\n"
else
    echo "❌ Could not get auth token"
fi

echo ""
echo "✅ Done! Inventory routes should now work."
