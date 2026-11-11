ALTER TABLE variantes
ADD COLUMN IF NOT EXISTS costo_reposicion NUMERIC(14,4);

ALTER TABLE variantes
ADD COLUMN IF NOT EXISTS costo_reposicion_moneda VARCHAR(3) NOT NULL DEFAULT 'ARS';

ALTER TABLE variantes
ADD COLUMN IF NOT EXISTS costo_reposicion_fecha TIMESTAMPTZ;

ALTER TABLE variantes
ADD COLUMN IF NOT EXISTS costo_reposicion_proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL;

ALTER TABLE variantes
ADD COLUMN IF NOT EXISTS costo_reposicion_origen VARCHAR(40);

UPDATE variantes
SET
    costo_reposicion = costo_promedio_vigente,
    costo_reposicion_moneda = 'ARS',
    costo_reposicion_fecha = COALESCE(updated_at, NOW()),
    costo_reposicion_proveedor_id = proveedor_preferido_id,
    costo_reposicion_origen = 'migracion_costo_promedio'
WHERE costo_reposicion IS NULL
  AND costo_promedio_vigente IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_variantes_costo_reposicion_no_negativo'
    ) THEN
        ALTER TABLE variantes
        ADD CONSTRAINT chk_variantes_costo_reposicion_no_negativo
        CHECK (costo_reposicion IS NULL OR costo_reposicion >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_variantes_costo_reposicion_proveedor
ON variantes (costo_reposicion_proveedor_id);

CREATE INDEX IF NOT EXISTS idx_variantes_costo_reposicion_fecha
ON variantes (costo_reposicion_fecha DESC)
WHERE costo_reposicion IS NOT NULL;
