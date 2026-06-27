-- Migration 036: Add MFA/TOTP support to users table

-- Add TOTP secret and MFA enabled flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[];

-- Create index for MFA queries
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled);

-- Add comments for documentation
COMMENT ON COLUMN users.totp_secret IS 'TOTP secret for 2FA (Time-based One-Time Password), encrypted or base32 encoded';
COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA is enabled for this user account';
COMMENT ON COLUMN users.mfa_backup_codes IS 'Hashed backup codes for account recovery when TOTP device is unavailable';
