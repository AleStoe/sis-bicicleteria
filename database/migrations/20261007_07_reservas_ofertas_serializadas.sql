BEGIN;

ALTER TABLE reservas
    ADD COLUMN IF NOT EXISTS base_sin_descuento_contado NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE reserva_items
    ADD COLUMN IF NOT EXISTS id_oferta BIGINT REFERENCES ofertas(id),
    ADD COLUMN IF NOT EXISTS precio_catalogo_original NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS descuento_oferta_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS oferta_nombre_snapshot VARCHAR(200),
    ADD COLUMN IF NOT EXISTS oferta_alcance_snapshot VARCHAR(20),
    ADD COLUMN IF NOT EXISTS oferta_politica_contado_snapshot VARCHAR(40);

ALTER TABLE reservas
    DROP CONSTRAINT IF EXISTS chk_reservas_base_sin_descuento_contado;
ALTER TABLE reservas
    ADD CONSTRAINT chk_reservas_base_sin_descuento_contado
        CHECK (
            base_sin_descuento_contado >= 0
            AND base_sin_descuento_contado <= (sena_total + saldo_estimado)
        );

COMMIT;
