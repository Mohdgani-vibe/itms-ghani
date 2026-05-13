ALTER TABLE asset_compute_details
ADD COLUMN IF NOT EXISTS logged_in_users_json JSONB NOT NULL DEFAULT '[]'::jsonb;