-- Add asset_tag to stock_items for inventory item enhancements
ALTER TABLE stock_items ADD COLUMN asset_tag TEXT;
-- Optionally enforce uniqueness if required:
-- ALTER TABLE stock_items ADD CONSTRAINT unique_asset_tag UNIQUE(asset_tag);
