ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS origen_extraccion VARCHAR(20) NOT NULL DEFAULT 'estructurado',
ADD COLUMN IF NOT EXISTS confianza_codigo NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS confianza_descripcion NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS confianza_cantidad NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS confianza_costo NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS lectura_confirmada BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_origen_extraccion;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_origen_extraccion CHECK (
    origen_extraccion IN ('estructurado', 'ocr', 'manual')
);

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_confianzas;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_confianzas CHECK (
    (confianza_codigo IS NULL OR confianza_codigo BETWEEN 0 AND 1)
    AND (confianza_descripcion IS NULL OR confianza_descripcion BETWEEN 0 AND 1)
    AND (confianza_cantidad IS NULL OR confianza_cantidad BETWEEN 0 AND 1)
    AND (confianza_costo IS NULL OR confianza_costo BETWEEN 0 AND 1)
);
