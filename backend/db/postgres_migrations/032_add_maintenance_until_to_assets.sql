-- Migration 032: Add maintenance_until column to assets table
-- Purpose: Enable maintenance mode to suppress alerts during scheduled maintenance windows
-- Date: 2026-06-27

-- Add maintenance_until column to track when maintenance window ends
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS maintenance_until TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN assets.maintenance_until IS 'Timestamp until which this asset is in maintenance mode. Alerts will be suppressed while NOW() < maintenance_until.';
