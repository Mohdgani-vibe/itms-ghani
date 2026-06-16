# User Password Reset Guide

This guide covers all methods for resetting user passwords in ITMS.

## Table of Contents

- [Method 1: UI Password Reset (Super Admin)](#method-1-ui-password-reset-super-admin)
- [Method 2: API Password Reset](#method-2-api-password-reset)
- [Method 3: Admin Password Sync (Default Admin)](#method-3-admin-password-sync-default-admin)
- [Password Requirements](#password-requirements)
- [Troubleshooting](#troubleshooting)

---

## Method 1: UI Password Reset (Super Admin)

**Requirements:** Super Admin role

### Steps:

1. **Login as Super Admin**
   - Navigate to: `http://YOUR_SERVER_IP/`
   - Login with super admin credentials

2. **Go to Users Page**
   - Click "Users" in the navigation menu
   - Or navigate to: `http://YOUR_SERVER_IP/admin/users`

3. **Find the User**
   - Use the search box to find the user by name, email, or employee ID
   - Or scroll through the user list

4. **Reset Password**
   - Click on the user card
   - Click "Reset Password" button
   - Enter a new temporary password (minimum 12 characters)
   - Click "Reset Password" to save

5. **Notify the User**
   - Provide the temporary password to the user securely
   - Ask them to change it after first login

### Password Requirements:
- Minimum 12 characters
- Must be a strong password (validated by backend)

---

## Method 2: API Password Reset

**Requirements:** Super Admin or IT Team role with valid auth token

### Get Authentication Token

First, login to get an auth token:

```bash
# On production server
TOKEN=$(curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YOUR_ADMIN_PASSWORD"}' \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

echo $TOKEN
```

### Reset User Password

```bash
# Find user ID first (optional, if you don't know it)
curl -X GET http://localhost/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -s | python3 -m json.tool | grep -A 10 "user@example.com"

# Reset password for specific user
USER_ID="ecca8262-b13c-4d22-a9a3-dfbaeeaab42a"  # Replace with actual user ID
NEW_PASSWORD="NewStrong#Password123"             # Minimum 12 characters

curl -X PATCH http://localhost/api/users/$USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"initial_password\": \"$NEW_PASSWORD\"
  }" | python3 -m json.tool

# Expected response: {"ok": true}
```

### Example: Reset Password for Employee

```bash
# Complete example
#!/bin/bash

# Configuration
SERVER_URL="http://172.10.80.16"
ADMIN_EMAIL="admin@zerodha.com"
ADMIN_PASSWORD="Zer0dhA@2026"
TARGET_USER_EMAIL="rakshith.kn@zerodha.com"
NEW_PASSWORD="Rakshith@NewPass2026"

# Login
echo "Logging in as admin..."
TOKEN=$(curl -X POST $SERVER_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

if [ -z "$TOKEN" ]; then
  echo "Failed to get auth token"
  exit 1
fi

echo "Token: $TOKEN"

# Find user by email
echo "Finding user: $TARGET_USER_EMAIL"
USER_DATA=$(curl -X GET "$SERVER_URL/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  -s | python3 -c "
import sys, json
data = json.load(sys.stdin)
for user in data.get('items', []):
    if user.get('email') == '$TARGET_USER_EMAIL':
        print(json.dumps(user))
        break
")

if [ -z "$USER_DATA" ]; then
  echo "User not found: $TARGET_USER_EMAIL"
  exit 1
fi

USER_ID=$(echo "$USER_DATA" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Found user ID: $USER_ID"

# Reset password
echo "Resetting password..."
curl -X PATCH "$SERVER_URL/api/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"initial_password\":\"$NEW_PASSWORD\"}" \
  | python3 -m json.tool

echo "Password reset complete!"
```

Save this as `reset-user-password.sh`, make it executable, and run it:

```bash
chmod +x reset-user-password.sh
./reset-user-password.sh
```

---

## Method 3: Admin Password Sync (Default Admin)

**Use Case:** When you need to rotate the default admin password stored in the database to match the `.env` file.

### Steps:

1. **Update Backend Environment File**

```bash
cd /home/itms/itms/backend

# Edit .env.secrets
nano .env.secrets

# Update this line:
DEFAULT_ADMIN_PASSWORD=YourNew#AdminPassword2026
```

2. **Run Password Sync Command**

```bash
cd /home/itms/itms/backend

# Load environment variables
set -a
source .env
source .env.secrets
set +a

# Sync the password to database
GOTOOLCHAIN=local go run ./cmd/sync_default_admin_password
```

Expected output:
```
Updated password hash for admin@zerodha.com.
```

3. **Verify Login**

```bash
# Test the new password
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zerodha.com","password":"YourNew#AdminPassword2026"}' \
  | python3 -m json.tool
```

### When to Use This Method:

- After rotating admin credentials in `.env.secrets`
- When restoring from database backup with different admin password
- When the admin password in the database doesn't match the environment file

---

## Password Requirements

All passwords must meet these criteria:

- **Minimum length:** 12 characters
- **Required for:** All user accounts (admin, IT team, employees)
- **Validation:** Enforced by backend API

### Examples of Valid Passwords:

```
Zer0dhA@2026          ✓ (14 chars, mixed case, numbers, symbols)
Rakshith@123456       ✓ (15 chars, mixed case, numbers, symbol)
StrongPass#2026!      ✓ (16 chars, mixed case, numbers, symbols)
```

### Examples of Invalid Passwords:

```
password          ✗ Too short (8 chars)
Pass123           ✗ Too short (7 chars)
short             ✗ Too short (5 chars)
```

---

## Troubleshooting

### Error: "password must be at least 12 characters"

**Solution:** Ensure the new password has at least 12 characters.

```bash
# Bad
NEW_PASSWORD="Pass123"

# Good
NEW_PASSWORD="Pass123456789"
```

### Error: "only super admin can update portal access"

**Solution:** You're trying to change the user's role while resetting password. Either:
1. Login as super admin
2. Or remove the `role` field from your API request

```bash
# Only reset password (works for IT team)
curl -X PATCH http://localhost/api/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"initial_password":"NewPassword123456"}'
```

### Error: "user not found"

**Solution:** 
1. Verify the user ID is correct
2. Check if you have access to the user's entity
3. Ensure you're using the correct auth token

```bash
# List all users to find the correct ID
curl -X GET http://localhost/api/users \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | grep -A 5 "email"
```

### Error: "no user found for admin@zerodha.com" (sync_default_admin_password)

**Solution:**
1. Check that the admin user exists in the database
2. Verify `DEFAULT_ADMIN_EMAIL` in `.env` matches the database
3. Ensure you've loaded environment variables with `source .env`

---

## Security Best Practices

1. **Use Strong Passwords**
   - Always use passwords with at least 12 characters
   - Include uppercase, lowercase, numbers, and symbols
   - Avoid dictionary words

2. **Secure Password Delivery**
   - Never send passwords via unencrypted email
   - Use secure channels (encrypted chat, in-person)
   - Consider using password managers

3. **Temporary Passwords**
   - Mark temporary passwords for first-time users
   - Require password change on first login
   - Set expiration for temporary passwords

4. **Audit Trail**
   - All password resets are logged in audit trail
   - Review audit logs regularly
   - Monitor for suspicious activity

5. **Rotate Admin Credentials**
   - Change admin password regularly (every 90 days)
   - Use `sync_default_admin_password` to update database
   - Keep `.env.secrets` file secure (chmod 600)

---

## Quick Reference

### UI Method (Recommended)
```
1. Login as super admin
2. Go to Users page
3. Find user → Click "Reset Password"
4. Enter new password (12+ chars)
5. Click "Reset Password"
```

### API Method (Automated)
```bash
TOKEN=$(curl -X POST http://localhost/api/auth/login \
  -d '{"email":"admin@zerodha.com","password":"YOUR_PASS"}' \
  -s | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

curl -X PATCH http://localhost/api/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"initial_password":"NewPassword123456"}'
```

### Admin Sync Method
```bash
cd backend
source .env && source .env.secrets
go run ./cmd/sync_default_admin_password
```

---

## Related Documentation

- [User Management Guide](user-management.md)
- [Security Hardening](security-hardening.md)
- [Audit Trail](audit-trail.md)
