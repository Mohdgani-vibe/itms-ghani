-- Add missing columns to asset_compute_details table
-- These columns are already being queried by router.go fetchAssetDetailBlocks()
-- but were missing from the original schema definition

ALTER TABLE asset_compute_details
ADD COLUMN IF NOT EXISTS os_version TEXT,
ADD COLUMN IF NOT EXISTS architecture TEXT,
ADD COLUMN IF NOT EXISTS os_build TEXT,
ADD COLUMN IF NOT EXISTS anydesk_id TEXT,
ADD COLUMN IF NOT EXISTS rustdesk_id TEXT,
ADD COLUMN IF NOT EXISTS disk_layout TEXT,
ADD COLUMN IF NOT EXISTS volumes_json JSONB NOT NULL DEFAULT '[]'::jsonb;
