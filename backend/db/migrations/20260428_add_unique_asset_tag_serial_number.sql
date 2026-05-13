-- Migration: Enforce uniqueness for asset_tag and serial_number in stock_items
ALTER TABLE stock_items
ADD CONSTRAINT unique_asset_tag UNIQUE (asset_tag);

ALTER TABLE stock_items
ADD CONSTRAINT unique_serial_number UNIQUE (serial_number);