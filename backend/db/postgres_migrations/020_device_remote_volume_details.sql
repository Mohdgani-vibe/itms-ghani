ALTER TABLE asset_compute_details
  ADD COLUMN IF NOT EXISTS anydesk_id TEXT,
  ADD COLUMN IF NOT EXISTS rustdesk_id TEXT,
  ADD COLUMN IF NOT EXISTS disk_layout TEXT,
  ADD COLUMN IF NOT EXISTS volumes_json JSONB NOT NULL DEFAULT '[]'::jsonb;
