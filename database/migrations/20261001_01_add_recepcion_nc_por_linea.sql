ALTER TABLE recepcion_mercaderia_costos
ADD COLUMN IF NOT EXISTS nota_credito_modo VARCHAR(20) NOT NULL DEFAULT 'global';

ALTER TABLE recepcion_mercaderia_costos
DROP CONSTRAINT IF EXISTS chk_recepcion_nota_credito_modo;

ALTER TABLE recepcion_mercaderia_costos
ADD CONSTRAINT chk_recepcion_nota_credito_modo
CHECK (nota_credito_modo IN ('global', 'lineas'));

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS nota_credito_linea_monto NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_nota_credito_linea;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_nota_credito_linea
CHECK (nota_credito_linea_monto >= 0);
