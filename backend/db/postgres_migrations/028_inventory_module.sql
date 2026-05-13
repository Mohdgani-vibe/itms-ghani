CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  contact_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  item_code VARCHAR(32) NOT NULL UNIQUE,
  company_name VARCHAR(150),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  operating_system VARCHAR(120),
  asset_type VARCHAR(20) NOT NULL DEFAULT 'non_critical',
  specs_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, name)
);

CREATE TABLE IF NOT EXISTS inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_item_id UUID NOT NULL REFERENCES sub_items(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_item_id, branch_id)
);

CREATE TABLE IF NOT EXISTS inventory_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_item_id UUID NOT NULL REFERENCES sub_items(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  operation VARCHAR(20) NOT NULL,
  from_branch_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  to_branch_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS sub_item_id UUID REFERENCES sub_items(id) ON DELETE SET NULL;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS company_name VARCHAR(150);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS operating_system VARCHAR(120);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS asset_type VARCHAR(20) DEFAULT 'non_critical';
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS remarks TEXT;

UPDATE stock_items
SET asset_type = 'non_critical'
WHERE asset_type IS NULL OR btrim(asset_type) = '';

ALTER TABLE stock_items ALTER COLUMN asset_type SET DEFAULT 'non_critical';

INSERT INTO items (name)
SELECT DISTINCT btrim(category)
FROM stock_items
WHERE btrim(category) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO sub_items (item_id, name, item_code, specs_remarks, asset_type)
SELECT i.id,
       btrim(s.name),
       s.item_code,
       NULLIF(btrim(COALESCE(s.specs, '')), ''),
       COALESCE(NULLIF(btrim(s.asset_type), ''), 'non_critical')
FROM stock_items s
JOIN items i ON i.name = btrim(s.category)
WHERE btrim(s.name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM sub_items existing WHERE existing.item_code = s.item_code
  );

UPDATE stock_items s
SET sub_item_id = si.id
FROM sub_items si
WHERE s.sub_item_id IS NULL
  AND si.item_code = s.item_code;

INSERT INTO inventory_stock (sub_item_id, branch_id, quantity)
SELECT s.sub_item_id,
       s.branch_id,
       COUNT(*)::integer
FROM stock_items s
WHERE s.sub_item_id IS NOT NULL
  AND s.branch_id IS NOT NULL
GROUP BY s.sub_item_id, s.branch_id
ON CONFLICT (sub_item_id, branch_id) DO UPDATE
SET quantity = EXCLUDED.quantity,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_sub_items_item_id ON sub_items(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_branch_id ON inventory_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_movements_sub_item_id ON inventory_stock_movements(sub_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_items_sub_item_id ON stock_items(sub_item_id);