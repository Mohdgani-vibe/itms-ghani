-- Migration 035: Add secure credential vault for passwords and secrets

-- Create vault_credentials table for encrypted password storage
CREATE TABLE IF NOT EXISTS vault_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT,
  encrypted_password BYTEA NOT NULL,
  encrypted_notes BYTEA,
  credential_type VARCHAR(50) DEFAULT 'password',
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  url TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create vault_access_log for audit trail
CREATE TABLE IF NOT EXISTS vault_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES vault_credentials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  access_type VARCHAR(30) NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create vault_shares for sharing credentials between users/teams
CREATE TABLE IF NOT EXISTS vault_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES vault_credentials(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_role VARCHAR(30),
  permission VARCHAR(20) NOT NULL DEFAULT 'view',
  shared_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_share_target CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_role IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_role IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vault_credentials_asset_id ON vault_credentials(asset_id);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_created_by ON vault_credentials(created_by);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_type ON vault_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_name ON vault_credentials(name);

CREATE INDEX IF NOT EXISTS idx_vault_access_log_credential_id ON vault_access_log(credential_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_access_log_user_id ON vault_access_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_shares_credential_id ON vault_shares(credential_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_user_id ON vault_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_role ON vault_shares(shared_with_role);

-- Add comments for documentation
COMMENT ON TABLE vault_credentials IS 'Secure encrypted storage for passwords, API keys, and service accounts';
COMMENT ON COLUMN vault_credentials.encrypted_password IS 'AES-256-GCM encrypted password/secret (MUST be encrypted before INSERT)';
COMMENT ON COLUMN vault_credentials.encrypted_notes IS 'AES-256-GCM encrypted notes field for additional secure information';
COMMENT ON COLUMN vault_credentials.credential_type IS 'Type: password, api_key, ssh_key, service_account, database, certificate';
COMMENT ON COLUMN vault_credentials.asset_id IS 'Optional link to specific device/asset';
COMMENT ON COLUMN vault_credentials.last_accessed_at IS 'Timestamp of last password reveal/access';
COMMENT ON COLUMN vault_credentials.access_count IS 'Number of times this credential was accessed';

COMMENT ON TABLE vault_access_log IS 'Audit trail for all credential access operations';
COMMENT ON COLUMN vault_access_log.access_type IS 'Type: view, copy, update, delete, share';

COMMENT ON TABLE vault_shares IS 'Share credentials with specific users or roles';
COMMENT ON COLUMN vault_shares.permission IS 'Permission level: view, edit, manage (manage includes sharing)';
COMMENT ON COLUMN vault_shares.shared_with_user_id IS 'Share with specific user (mutually exclusive with role)';
COMMENT ON COLUMN vault_shares.shared_with_role IS 'Share with role: super_admin, it_team, auditor (mutually exclusive with user)';

-- Create function to update last_accessed_at and increment access_count
CREATE OR REPLACE FUNCTION record_vault_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vault_credentials
  SET last_accessed_at = NOW(),
      access_count = access_count + 1
  WHERE id = NEW.credential_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_vault_access
AFTER INSERT ON vault_access_log
FOR EACH ROW
WHEN (NEW.access_type IN ('view', 'copy'))
EXECUTE FUNCTION record_vault_access();

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_vault_credentials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_vault_credentials_timestamp
BEFORE UPDATE ON vault_credentials
FOR EACH ROW
EXECUTE FUNCTION update_vault_credentials_timestamp();
