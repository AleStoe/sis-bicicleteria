BEGIN;

ALTER TABLE precio_lista_lotes
ADD COLUMN IF NOT EXISTS preview_generado_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS estrategia_preview VARCHAR(30),
ADD COLUMN IF NOT EXISTS alerta_variacion_pct NUMERIC(7,2),
ADD COLUMN IF NOT EXISTS descuento_minorista_pct NUMERIC(7,2),
ADD COLUMN IF NOT EXISTS descuento_mayorista_pct NUMERIC(7,2),
ADD COLUMN IF NOT EXISTS redondeo_minorista NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS redondeo_mayorista NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS preview_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE precio_lista_lotes
DROP CONSTRAINT IF EXISTS chk_precio_lista_lote_estado;

ALTER TABLE precio_lista_lotes
ADD CONSTRAINT chk_precio_lista_lote_estado CHECK (
    estado IN (
        'borrador', 'procesando', 'requiere_revision', 'listo_para_revisar',
        'listo_para_aplicar', 'aplicado', 'revertido', 'anulado', 'error'
    )
);

ALTER TABLE precio_lista_items
ADD COLUMN IF NOT EXISTS costo_reposicion_anterior_snapshot NUMERIC(14,4),
ADD COLUMN IF NOT EXISTS costo_reposicion_nuevo NUMERIC(14,4),
ADD COLUMN IF NOT EXISTS costo_variacion_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS precio_minorista_anterior_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS precio_mayorista_anterior_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS precio_minorista_propuesto NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS precio_mayorista_propuesto NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS margen_minorista_anterior_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS margen_mayorista_anterior_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS margen_minorista_resultante_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS margen_mayorista_resultante_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS estrategia_minorista VARCHAR(30),
ADD COLUMN IF NOT EXISTS estrategia_mayorista VARCHAR(30),
ADD COLUMN IF NOT EXISTS descuento_minorista_snapshot NUMERIC(7,2),
ADD COLUMN IF NOT EXISTS descuento_mayorista_snapshot NUMERIC(7,2),
ADD COLUMN IF NOT EXISTS redondeo_minorista_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS redondeo_mayorista_snapshot NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS regla_minorista_snapshot JSONB,
ADD COLUMN IF NOT EXISTS regla_mayorista_snapshot JSONB,
ADD COLUMN IF NOT EXISTS oferta_vigente_snapshot JSONB,
ADD COLUMN IF NOT EXISTS permite_precio_libre_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS precio_libre_confirmado BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alertas_preview JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS explicacion_preview JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS seleccionado_aplicar BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS preview_valido BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS preview_generado_at TIMESTAMPTZ;

ALTER TABLE precio_lista_items
DROP CONSTRAINT IF EXISTS chk_precio_lista_item_estrategia_minorista;

ALTER TABLE precio_lista_items
ADD CONSTRAINT chk_precio_lista_item_estrategia_minorista CHECK (
    estrategia_minorista IS NULL OR estrategia_minorista IN (
        'conservar_margen', 'usar_regla', 'mantener_precio', 'manual', 'ignorar'
    )
);

ALTER TABLE precio_lista_items
DROP CONSTRAINT IF EXISTS chk_precio_lista_item_estrategia_mayorista;

ALTER TABLE precio_lista_items
ADD CONSTRAINT chk_precio_lista_item_estrategia_mayorista CHECK (
    estrategia_mayorista IS NULL OR estrategia_mayorista IN (
        'conservar_margen', 'usar_regla', 'mantener_precio', 'manual', 'ignorar'
    )
);

CREATE INDEX IF NOT EXISTS idx_precio_lista_items_preview
ON precio_lista_items (id_lote, preview_valido, seleccionado_aplicar);

COMMIT;
