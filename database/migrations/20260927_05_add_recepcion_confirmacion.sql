ALTER TABLE recepciones_mercaderia
ADD COLUMN IF NOT EXISTS confirmada_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_usuario_confirmador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS precio_minorista_propuesto NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS precio_mayorista_propuesto NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS serializable_propuesto BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS id_producto_confirmado INTEGER REFERENCES productos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS id_variante_confirmada INTEGER REFERENCES variantes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS id_ingreso_stock INTEGER REFERENCES ingresos_stock(id) ON DELETE SET NULL;

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_precios_propuestos;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_precios_propuestos CHECK (
    (precio_minorista_propuesto IS NULL OR precio_minorista_propuesto >= 0)
    AND (precio_mayorista_propuesto IS NULL OR precio_mayorista_propuesto >= 0)
);
