BEGIN;

ALTER TABLE credito_movimientos
    ADD COLUMN IF NOT EXISTS monto_base_aplicado NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS monto_descuento_aplicado NUMERIC(14,2);

UPDATE credito_movimientos
SET monto_base_aplicado = monto,
    monto_descuento_aplicado = 0
WHERE tipo_movimiento = 'aplicacion_a_venta'
  AND monto_base_aplicado IS NULL;

COMMIT;
