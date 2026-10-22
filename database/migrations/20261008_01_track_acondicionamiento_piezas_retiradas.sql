BEGIN;

ALTER TABLE bicicleta_acondicionamiento_items
    ADD COLUMN IF NOT EXISTS destino_pieza_retirada VARCHAR(20),
    ADD COLUMN IF NOT EXISTS estado_pieza_retirada VARCHAR(20),
    ADD COLUMN IF NOT EXISTS resolucion_pieza_retirada VARCHAR(500),
    ADD COLUMN IF NOT EXISTS fecha_resolucion_pieza_retirada TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS id_usuario_resolucion_pieza_retirada BIGINT REFERENCES usuarios(id);

ALTER TABLE bicicleta_acondicionamiento_items
    DROP CONSTRAINT IF EXISTS chk_acond_item_destino_pieza_retirada,
    DROP CONSTRAINT IF EXISTS chk_acond_item_estado_pieza_retirada,
    ADD CONSTRAINT chk_acond_item_destino_pieza_retirada
        CHECK (destino_pieza_retirada IS NULL OR destino_pieza_retirada IN ('descarte', 'garantia', 'recuperable')),
    ADD CONSTRAINT chk_acond_item_estado_pieza_retirada
        CHECK (estado_pieza_retirada IS NULL OR estado_pieza_retirada IN ('pendiente', 'descartada', 'en_garantia', 'compensada', 'recuperada', 'revertida'));

CREATE INDEX IF NOT EXISTS idx_acond_items_piezas_retiradas_pendientes
    ON bicicleta_acondicionamiento_items (destino_pieza_retirada, estado_pieza_retirada)
    WHERE destino_pieza_retirada IS NOT NULL
      AND estado_pieza_retirada IN ('pendiente', 'en_garantia');

COMMIT;
