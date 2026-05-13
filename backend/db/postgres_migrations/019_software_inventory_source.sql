ALTER TABLE asset_software_inventory
ADD COLUMN IF NOT EXISTS source VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_asset_software_inventory_asset_source
ON asset_software_inventory (asset_id, source);