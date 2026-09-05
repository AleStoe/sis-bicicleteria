UPDATE deudas_cliente
SET
    estado = 'cerrada',
    saldo_actual = 0,
    updated_at = NOW()
WHERE estado = 'abierta'
  AND saldo_actual <= 1;
