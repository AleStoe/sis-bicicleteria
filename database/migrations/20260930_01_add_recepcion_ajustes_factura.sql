ALTER TABLE recepcion_mercaderia_costos
ADD COLUMN IF NOT EXISTS bonificacion_factura NUMERIC(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_factura NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE recepcion_mercaderia_costos
DROP CONSTRAINT IF EXISTS chk_recepcion_costo_ajustes_factura;

ALTER TABLE recepcion_mercaderia_costos
ADD CONSTRAINT chk_recepcion_costo_ajustes_factura
CHECK (bonificacion_factura >= 0 AND iva_factura >= 0);

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS prorrateo_bonificacion_factura NUMERIC(14,2);
