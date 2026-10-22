ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS nombre_propuesto VARCHAR(250),
ADD COLUMN IF NOT EXISTS nombre_variante_propuesta VARCHAR(120) DEFAULT 'UNICA',
ADD COLUMN IF NOT EXISTS rubro_propuesto VARCHAR(80),
ADD COLUMN IF NOT EXISTS id_categoria_propuesta INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS id_marca_propuesta INTEGER REFERENCES marcas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subtipo_propuesto VARCHAR(80),
ADD COLUMN IF NOT EXISTS sku_propuesto VARCHAR(40),
ADD COLUMN IF NOT EXISTS confianza_sugerencia VARCHAR(20);

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_estado;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_estado CHECK (
    estado_resolucion IN (
        'exacta',
        'sugerida',
        'nueva',
        'alta_preparada',
        'conflicto',
        'incompleta'
    )
);

CREATE INDEX IF NOT EXISTS idx_recepcion_items_categoria_propuesta
ON recepcion_mercaderia_items (id_categoria_propuesta);
