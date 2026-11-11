BEGIN;

ALTER TABLE precio_lista_items
ADD COLUMN IF NOT EXISTS codigo_normalizado VARCHAR(120),
ADD COLUMN IF NOT EXISTS estado_coincidencia VARCHAR(30) NOT NULL DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS id_variante INTEGER REFERENCES variantes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS origen_coincidencia VARCHAR(40),
ADD COLUMN IF NOT EXISTS confianza_coincidencia NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS candidatos JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS mensaje_coincidencia VARCHAR(500),
ADD COLUMN IF NOT EXISTS coincidencia_confirmada BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS id_usuario_confirmacion INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS confirmado_at TIMESTAMPTZ;

ALTER TABLE precio_lista_items
DROP CONSTRAINT IF EXISTS chk_precio_lista_item_coincidencia;

ALTER TABLE precio_lista_items
ADD CONSTRAINT chk_precio_lista_item_coincidencia CHECK (
    estado_coincidencia IN (
        'pendiente', 'exacta', 'sugerida', 'ambigua', 'sin_coincidencia', 'descartada'
    )
);

CREATE INDEX IF NOT EXISTS idx_precio_lista_items_coincidencia
ON precio_lista_items (id_lote, estado_coincidencia, numero_fila);

CREATE INDEX IF NOT EXISTS idx_precio_lista_items_variante
ON precio_lista_items (id_variante)
WHERE id_variante IS NOT NULL;

COMMIT;
