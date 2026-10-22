BEGIN;

ALTER TABLE ofertas
    ADD COLUMN IF NOT EXISTS alcance VARCHAR(20) NOT NULL DEFAULT 'variante',
    ADD COLUMN IF NOT EXISTS politica_contado VARCHAR(30) NOT NULL DEFAULT 'precio_lista_promocional';

ALTER TABLE ofertas
    DROP CONSTRAINT IF EXISTS chk_ofertas_alcance;
ALTER TABLE ofertas
    ADD CONSTRAINT chk_ofertas_alcance
        CHECK (alcance IN ('variante', 'unidades'));

ALTER TABLE ofertas
    DROP CONSTRAINT IF EXISTS chk_ofertas_politica_contado;
ALTER TABLE ofertas
    ADD CONSTRAINT chk_ofertas_politica_contado
        CHECK (politica_contado IN ('precio_lista_promocional', 'precio_final_contado'));

CREATE TABLE IF NOT EXISTS oferta_bicicletas_serializadas (
    id BIGSERIAL PRIMARY KEY,
    id_oferta BIGINT NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
    id_bicicleta_serializada BIGINT NOT NULL REFERENCES bicicletas_serializadas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_oferta_bicicleta_serializada UNIQUE (id_oferta, id_bicicleta_serializada)
);

CREATE INDEX IF NOT EXISTS idx_oferta_bicis_unidad
    ON oferta_bicicletas_serializadas (id_bicicleta_serializada, id_oferta);

ALTER TABLE venta_items
    ADD COLUMN IF NOT EXISTS oferta_alcance_snapshot VARCHAR(20),
    ADD COLUMN IF NOT EXISTS oferta_politica_contado_snapshot VARCHAR(30);

UPDATE venta_items vi
SET oferta_alcance_snapshot = COALESCE(o.alcance, 'variante'),
    oferta_politica_contado_snapshot = COALESCE(o.politica_contado, 'precio_lista_promocional')
FROM ofertas o
WHERE vi.id_oferta = o.id
  AND vi.oferta_alcance_snapshot IS NULL;

COMMIT;
