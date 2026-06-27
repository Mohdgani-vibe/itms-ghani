-- Migration 034: Add backup_status, remote_sessions, update requests, and add IT documentation tables

-- Create backup_status table to track device backups
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

-- Create remote_sessions table for SSH/terminal audit trail
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

-- Add columns to requests table for SLA tracking and ticket management
ALTER TABLE requests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL;

-- Create IT documentation tables (knowledge base)
CREATE TABLE IF NOT EXISTS it_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(250) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  tags TEXT[],
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS it_doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES it_docs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(250) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS it_doc_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES it_docs(id) ON DELETE CASCADE,
  filename VARCHAR(250) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_status_asset_id ON backup_status(asset_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_status_status ON backup_status(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_status_backup_type ON backup_status(backup_type);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_asset_id ON remote_sessions(asset_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_user_id ON remote_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_session_id ON remote_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_sla_deadline ON requests(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_requests_ticket_number ON requests(ticket_number);
CREATE INDEX IF NOT EXISTS idx_requests_alert_id ON requests(alert_id);

CREATE INDEX IF NOT EXISTS idx_it_docs_category ON it_docs(category);
CREATE INDEX IF NOT EXISTS idx_it_docs_author_id ON it_docs(author_id);
CREATE INDEX IF NOT EXISTS idx_it_docs_is_published ON it_docs(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_it_doc_versions_doc_id ON it_doc_versions(doc_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_it_doc_attachments_doc_id ON it_doc_attachments(doc_id);

-- Add comments for documentation
COMMENT ON TABLE backup_status IS 'Tracks backup operations for assets (RMM core functionality)';
COMMENT ON COLUMN backup_status.backup_type IS 'Type of backup: full, incremental, differential, snapshot';
COMMENT ON COLUMN backup_status.status IS 'Status: pending, running, completed, failed';

COMMENT ON TABLE remote_sessions IS 'Audit trail for SSH and terminal sessions';
COMMENT ON COLUMN remote_sessions.session_type IS 'Type: ssh, terminal, vnc, rdp';
COMMENT ON COLUMN remote_sessions.status IS 'Status: active, completed, terminated, timed_out';
COMMENT ON COLUMN remote_sessions.duration_seconds IS 'Session duration calculated as (ended_at - started_at) in seconds';

COMMENT ON COLUMN requests.priority IS 'Priority: low, medium, high, urgent, critical';
COMMENT ON COLUMN requests.sla_deadline IS 'SLA deadline calculated based on priority and creation time';
COMMENT ON COLUMN requests.ticket_number IS 'Sequential ticket number like TKT-001234';
COMMENT ON COLUMN requests.alert_id IS 'Optional link to alert that triggered this ticket';

COMMENT ON TABLE it_docs IS 'IT documentation and knowledge base articles';
COMMENT ON COLUMN it_docs.is_published IS 'Published articles are visible to all users, drafts only to author and admins';
COMMENT ON COLUMN it_docs.tags IS 'Array of searchable tags for categorization';

-- Create function to generate sequential ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  IF NEW.ticket_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM '[0-9]+') AS INTEGER)), 0) + 1
    INTO next_number
    FROM requests
    WHERE ticket_number ~ '^TKT-[0-9]+$';
    
    NEW.ticket_number := 'TKT-' || LPAD(next_number::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_ticket_number ON requests;
CREATE TRIGGER trg_generate_ticket_number
BEFORE INSERT ON requests
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number();

-- Create function to auto-calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
    IF NEW.status = 'active' THEN
      NEW.status := 'completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_session_duration ON remote_sessions;
CREATE TRIGGER trg_calculate_session_duration
BEFORE UPDATE ON remote_sessions
FOR EACH ROW
WHEN (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL)
EXECUTE FUNCTION calculate_session_duration();
