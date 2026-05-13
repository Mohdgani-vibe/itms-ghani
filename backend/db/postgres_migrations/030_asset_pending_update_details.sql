ALTER TABLE asset_compute_details
ADD COLUMN IF NOT EXISTS pending_update_details_json JSONB NOT NULL DEFAULT '[]'::jsonb;