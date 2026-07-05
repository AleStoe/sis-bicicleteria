BEGIN;

-- caja_movimientos.monto representa movimiento operativo neto.
-- El bruto pagado por el cliente permanece intacto en pagos.monto_total_cobrado.
INSERT INTO auditoria_eventos (
    id_usuario,
    id_sucursal,
    entidad,
    entidad_id,
    accion,
    detalle,
    metadata,
    origen_tipo,
    origen_id
)
SELECT
    cm.id_usuario,
    c.id_sucursal,
    'caja_movimiento',
    cm.id,
    'reconciliacion_neto_financiero',
    'Movimiento de pago reconciliado al neto operativo congelado.',
    jsonb_build_object(
        'monto_anterior', cm.monto,
        'monto_nuevo', p.monto_neto_liquidado,
        'pago_id', p.id,
        'bruto_cliente', p.monto_total_cobrado,
        'costo_financiero', p.monto_costo_financiero
    ),
    'pago',
    p.id
FROM caja_movimientos cm
INNER JOIN cajas c ON c.id = cm.id_caja
INNER JOIN pagos p
    ON cm.origen_tipo = 'pago'
   AND cm.origen_id = p.id
WHERE cm.monto IS DISTINCT FROM p.monto_neto_liquidado;

UPDATE caja_movimientos cm
SET monto = p.monto_neto_liquidado
FROM pagos p
WHERE cm.origen_tipo = 'pago'
  AND cm.origen_id = p.id
  AND cm.monto IS DISTINCT FROM p.monto_neto_liquidado;

-- Las reversiones deben deshacer exactamente el mismo neto del pago original.
INSERT INTO auditoria_eventos (
    id_usuario,
    id_sucursal,
    entidad,
    entidad_id,
    accion,
    detalle,
    metadata,
    origen_tipo,
    origen_id
)
SELECT
    cm.id_usuario,
    c.id_sucursal,
    'caja_movimiento',
    cm.id,
    'reconciliacion_neto_financiero',
    'Reversión de pago reconciliada al neto operativo congelado.',
    jsonb_build_object(
        'monto_anterior', cm.monto,
        'monto_nuevo', p.monto_neto_liquidado,
        'pago_original_id', p.id,
        'bruto_cliente', p.monto_total_cobrado,
        'costo_financiero', p.monto_costo_financiero
    ),
    'pago_reversion',
    pr.id
FROM caja_movimientos cm
INNER JOIN cajas c ON c.id = cm.id_caja
INNER JOIN pagos_reversiones pr
    ON cm.origen_tipo = 'pago_reversion'
   AND cm.origen_id = pr.id
INNER JOIN pagos p ON p.id = pr.id_pago_original
WHERE cm.monto IS DISTINCT FROM p.monto_neto_liquidado;

UPDATE caja_movimientos cm
SET monto = p.monto_neto_liquidado
FROM pagos_reversiones pr
INNER JOIN pagos p ON p.id = pr.id_pago_original
WHERE cm.origen_tipo = 'pago_reversion'
  AND cm.origen_id = pr.id
  AND cm.monto IS DISTINCT FROM p.monto_neto_liquidado;

COMMIT;
