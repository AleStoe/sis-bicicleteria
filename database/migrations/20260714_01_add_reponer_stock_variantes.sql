ALTER TABLE variantes
ADD COLUMN IF NOT EXISTS reponer_stock boolean NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_variantes_reponer_stock
ON variantes (reponer_stock);
