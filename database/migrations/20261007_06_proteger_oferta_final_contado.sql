BEGIN;

ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS base_sin_descuento_contado NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE ventas
    DROP CONSTRAINT IF EXISTS chk_ventas_base_sin_descuento_contado;
ALTER TABLE ventas
    ADD CONSTRAINT chk_ventas_base_sin_descuento_contado
        CHECK (
            base_sin_descuento_contado >= 0
            AND base_sin_descuento_contado <= subtotal_base
        );

COMMIT;
