ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_asset_tag_unique
  ON stock_items (asset_tag)
  WHERE asset_tag IS NOT NULL;