CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code VARCHAR(10) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  location_code VARCHAR(30) UNIQUE NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  city VARCHAR(80),
  state VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id),
  name VARCHAR(100) NOT NULL,
  short_code VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, name),
  UNIQUE (entity_id, short_code)
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) UNIQUE NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(80) UNIQUE NOT NULL,
  label VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id VARCHAR(10) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  entity_id UUID REFERENCES entities(id),
  dept_id UUID REFERENCES departments(id),
  location_id UUID REFERENCES locations(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  google_sub VARCHAR(100),
  password_hash TEXT,
  totp_secret TEXT,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_backup_codes TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_entity_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, entity_id)
);

CREATE TABLE IF NOT EXISTS hostname_sequences (
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  dept_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  next_seq INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_id, dept_id)
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  hostname VARCHAR(100) UNIQUE,
  category VARCHAR(50) NOT NULL,
  is_compute BOOLEAN NOT NULL DEFAULT FALSE,
  serial_number VARCHAR(100),
  model VARCHAR(100),
  entity_id UUID NOT NULL REFERENCES entities(id),
  assigned_to UUID REFERENCES users(id),
  dept_id UUID REFERENCES departments(id),
  location_id UUID REFERENCES locations(id),
  purchase_date DATE,
  warranty_until DATE,
  maintenance_until TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'in_use',
  condition VARCHAR(30) NOT NULL DEFAULT 'good',
  glpi_id INTEGER,
  salt_minion_id VARCHAR(100),
  wazuh_agent_id VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_compute_details (
  asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  processor TEXT,
  ram TEXT,
  storage TEXT,
  gpu TEXT,
  display TEXT,
  bios_version TEXT,
  mac_address TEXT,
  os_name TEXT,
  os_version TEXT,
  kernel TEXT,
  architecture TEXT,
  os_build TEXT,
  anydesk_id TEXT,
  rustdesk_id TEXT,
  disk_layout TEXT,
  volumes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_boot TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  logged_in_users_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_updates INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_software_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  version VARCHAR(80),
  install_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_network_snapshots (
  asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  wired_ip INET,
  wireless_ip INET,
  netbird_ip INET,
  dns TEXT,
  gateway INET,
  interface_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(60) NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  source VARCHAR(30) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  detail TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  mttr_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  entity_id UUID REFERENCES entities(id),
  action VARCHAR(60) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  auth_method VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  backup_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  size_bytes BIGINT,
  backup_location VARCHAR(500),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS remote_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  session_type VARCHAR(30) NOT NULL,
  session_id VARCHAR(100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  ip_address INET,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS vault_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES vault_credentials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  access_type VARCHAR(30) NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_users_entity_id ON users(entity_id);
CREATE INDEX IF NOT EXISTS idx_users_dept_id ON users(dept_id);
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled);
CREATE INDEX IF NOT EXISTS idx_assets_entity_id ON assets(entity_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id ON asset_history(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_alerts_source ON asset_alerts(source);
CREATE INDEX IF NOT EXISTS idx_asset_alerts_is_resolved ON asset_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_asset_alerts_source_resolved ON asset_alerts(source, is_resolved);
CREATE INDEX IF NOT EXISTS idx_asset_alerts_asset_resolved ON asset_alerts(asset_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_backup_status_asset_id ON backup_status(asset_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_status_status ON backup_status(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_status_backup_type ON backup_status(backup_type);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_asset_id ON remote_sessions(asset_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_user_id ON remote_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_session_id ON remote_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_asset_id ON vault_credentials(asset_id);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_created_by ON vault_credentials(created_by);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_type ON vault_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_name ON vault_credentials(name);
CREATE INDEX IF NOT EXISTS idx_vault_access_log_credential_id ON vault_access_log(credential_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_access_log_user_id ON vault_access_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_shares_credential_id ON vault_shares(credential_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_user_id ON vault_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_role ON vault_shares(shared_with_role);