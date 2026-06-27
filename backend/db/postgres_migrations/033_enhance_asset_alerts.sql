-- Migration 033: Add resolved_at, mttr_seconds, and performance indexes to asset_alerts and alerts

-- Add resolved_at timestamp to track when alerts are resolved (asset_alerts)
ALTER TABLE asset_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Add mttr_seconds (Mean Time To Resolution) for analytics (asset_alerts)
ALTER TABLE asset_alerts ADD COLUMN IF NOT EXISTS mttr_seconds INTEGER;

-- Add resolved_at timestamp to track when alerts are resolved (alerts)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Add mttr_seconds (Mean Time To Resolution) for analytics (alerts)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS mttr_seconds INTEGER;

-- Add index on source column (frequently filtered in collectAssetAlerts)
CREATE INDEX IF NOT EXISTS idx_asset_alerts_source ON asset_alerts(source);

-- Add index on is_resolved column (frequently filtered in queries)
CREATE INDEX IF NOT EXISTS idx_asset_alerts_is_resolved ON asset_alerts(is_resolved);

-- Composite index for common query pattern: source + is_resolved
CREATE INDEX IF NOT EXISTS idx_asset_alerts_source_resolved ON asset_alerts(source, is_resolved);

-- Index on asset_id + is_resolved for per-device alert queries
CREATE INDEX IF NOT EXISTS idx_asset_alerts_asset_resolved ON asset_alerts(asset_id, is_resolved);

-- Add index on source column for alerts table
CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);

-- Add index on resolved column for alerts table
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

-- Composite index for common query pattern: source + resolved
CREATE INDEX IF NOT EXISTS idx_alerts_source_resolved ON alerts(source, resolved);

-- Index on user_id + resolved for per-user alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_user_resolved ON alerts(user_id, resolved);

-- Add comments for documentation
COMMENT ON COLUMN asset_alerts.resolved_at IS 'Timestamp when the alert was resolved (marked as is_resolved = TRUE)';
COMMENT ON COLUMN asset_alerts.mttr_seconds IS 'Mean Time To Resolution in seconds (resolved_at - created_at)';
COMMENT ON COLUMN alerts.resolved_at IS 'Timestamp when the alert was resolved (marked as resolved = TRUE)';
COMMENT ON COLUMN alerts.mttr_seconds IS 'Mean Time To Resolution in seconds (resolved_at - created_at)';
