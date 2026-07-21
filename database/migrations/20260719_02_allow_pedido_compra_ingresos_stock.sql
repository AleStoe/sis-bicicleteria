ALTER TABLE ingresos_stock
DROP CONSTRAINT IF EXISTS chk_ingresos_stock_origen;

ALTER TABLE ingresos_stock
ADD CONSTRAINT chk_ingresos_stock_origen
CHECK (origen_ingreso IN ('inicial', 'manual', 'compra', 'pedido_compra'));
