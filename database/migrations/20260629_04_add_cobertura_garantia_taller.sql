ALTER TABLE ordenes_taller_items
    ADD COLUMN IF NOT EXISTS valor_cobertura_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS motivo_cobertura VARCHAR(80),
    ADD COLUMN IF NOT EXISTS observacion_cobertura TEXT;

ALTER TABLE ordenes_taller_items
    DROP CONSTRAINT IF EXISTS chk_orden_taller_item_cobertura;

ALTER TABLE ordenes_taller_items
    ADD CONSTRAINT chk_orden_taller_item_cobertura
    CHECK (
        valor_cobertura_unitario >= 0
        AND valor_cobertura_unitario <= precio_unitario
        AND (
            valor_cobertura_unitario = 0
            OR (
                tipo_item IN ('repuesto', 'servicio')
                AND NULLIF(TRIM(motivo_cobertura), '') IS NOT NULL
            )
        )
    );

ALTER TABLE venta_items
    ADD COLUMN IF NOT EXISTS bonificacion_unitaria NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE venta_items
    DROP CONSTRAINT IF EXISTS chk_venta_items_bonificacion_unitaria;

ALTER TABLE venta_items
    ADD CONSTRAINT chk_venta_items_bonificacion_unitaria
    CHECK (
        bonificacion_unitaria >= 0
        AND bonificacion_unitaria <= precio_lista
    );
