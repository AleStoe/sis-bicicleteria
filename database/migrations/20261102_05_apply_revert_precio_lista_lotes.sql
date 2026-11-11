BEGIN;

ALTER TABLE precio_lista_lotes
ADD COLUMN IF NOT EXISTS aplicado_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS aplicado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS preview_version_aplicada INTEGER,
ADD COLUMN IF NOT EXISTS revertido_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revertido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS motivo_reversion TEXT;

ALTER TABLE precio_lista_items
ADD COLUMN IF NOT EXISTS precio_movimiento_aplicacion_id INTEGER REFERENCES precios_movimientos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS precio_movimiento_reversion_id INTEGER REFERENCES precios_movimientos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS costo_reposicion_previo_real NUMERIC(14,4),
ADD COLUMN IF NOT EXISTS costo_reposicion_moneda_previa VARCHAR(3),
ADD COLUMN IF NOT EXISTS costo_reposicion_fecha_previa TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS costo_reposicion_proveedor_previo_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS costo_reposicion_origen_previo VARCHAR(40),
ADD COLUMN IF NOT EXISTS aplicado_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revertido_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_precio_lista_items_movimiento_aplicacion
ON precio_lista_items (precio_movimiento_aplicacion_id)
WHERE precio_movimiento_aplicacion_id IS NOT NULL;

COMMIT;
