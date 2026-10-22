ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS total_linea_documental NUMERIC(14,2);

COMMENT ON COLUMN recepcion_mercaderia_items.total_linea_documental IS
'Total exacto impreso por el proveedor para el renglón; evita diferencias por costos unitarios redondeados.';
