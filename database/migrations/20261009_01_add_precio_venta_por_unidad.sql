BEGIN;

ALTER TABLE bicicletas_serializadas
    ADD COLUMN IF NOT EXISTS precio_venta_personalizado NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS motivo_precio_venta VARCHAR(500),
    ADD COLUMN IF NOT EXISTS fecha_precio_venta TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS id_usuario_precio_venta BIGINT REFERENCES usuarios(id);

ALTER TABLE bicicletas_serializadas
    DROP CONSTRAINT IF EXISTS chk_bicicletas_serializadas_precio_personalizado;

ALTER TABLE bicicletas_serializadas
    ADD CONSTRAINT chk_bicicletas_serializadas_precio_personalizado
        CHECK (precio_venta_personalizado IS NULL OR precio_venta_personalizado > 0);

ALTER TABLE bicicleta_acondicionamientos
    ADD COLUMN IF NOT EXISTS precio_venta_actualizado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS precio_venta_personalizado_anterior NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS precio_venta_personalizado_nuevo NUMERIC(14,2);

COMMIT;
