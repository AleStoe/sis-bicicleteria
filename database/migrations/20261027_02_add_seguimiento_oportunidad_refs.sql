BEGIN;

ALTER TABLE cliente_seguimientos
    ADD COLUMN IF NOT EXISTS id_cotizacion BIGINT REFERENCES cotizaciones(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS id_caso_postventa BIGINT REFERENCES postventa_casos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cliente_seguimientos_cotizacion
    ON cliente_seguimientos (id_cotizacion, estado)
    WHERE id_cotizacion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_seguimientos_postventa
    ON cliente_seguimientos (id_caso_postventa, estado)
    WHERE id_caso_postventa IS NOT NULL;

COMMIT;
