BEGIN;

ALTER TABLE reglas_precio
ADD COLUMN IF NOT EXISTS rubro VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_reglas_precio_rubro
ON reglas_precio (UPPER(rubro))
WHERE rubro IS NOT NULL;

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS estrategia_precio VARCHAR(30),
ADD COLUMN IF NOT EXISTS costo_anterior_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS precio_minorista_anterior_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS precio_mayorista_anterior_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS margen_minorista_anterior_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS margen_mayorista_anterior_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS margen_minorista_resultante_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS margen_mayorista_resultante_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS id_regla_minorista INTEGER REFERENCES reglas_precio(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS id_regla_mayorista INTEGER REFERENCES reglas_precio(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS regla_minorista_snapshot VARCHAR(120),
ADD COLUMN IF NOT EXISTS regla_mayorista_snapshot VARCHAR(120),
ADD COLUMN IF NOT EXISTS alerta_precio VARCHAR(500),
ADD COLUMN IF NOT EXISTS precio_revisado BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS precio_revisado_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_usuario_precio INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_estrategia_precio;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_estrategia_precio CHECK (
    estrategia_precio IS NULL OR estrategia_precio IN (
        'reglas', 'mantener_margen', 'mantener_actuales', 'manual'
    )
);

COMMIT;
