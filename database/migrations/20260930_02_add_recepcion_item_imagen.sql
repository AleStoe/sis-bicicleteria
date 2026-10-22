BEGIN;

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS imagen_ruta_relativa VARCHAR(500),
ADD COLUMN IF NOT EXISTS imagen_nombre_original VARCHAR(255),
ADD COLUMN IF NOT EXISTS imagen_mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS imagen_tamano_bytes INTEGER;

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_imagen_tamano;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_imagen_tamano CHECK (
    imagen_tamano_bytes IS NULL OR imagen_tamano_bytes BETWEEN 1 AND 5242880
);

COMMIT;
