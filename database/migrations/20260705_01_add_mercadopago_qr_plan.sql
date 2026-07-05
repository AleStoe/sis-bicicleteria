BEGIN;

-- QR es un cobro electronico de un pago. No comparte semantica de cuotas.
UPDATE tarjeta_planes
SET cuotas = 1,
    updated_at = NOW()
WHERE medio_pago = 'mercadopago'
  AND cuotas <> 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_tarjeta_planes_mercadopago_una_cuota'
    ) THEN
        ALTER TABLE tarjeta_planes
            ADD CONSTRAINT chk_tarjeta_planes_mercadopago_una_cuota
            CHECK (medio_pago <> 'mercadopago' OR cuotas = 1);
    END IF;
END
$$;

-- Evita que dos planes QR genericos compitan por la seleccion automatica.
UPDATE tarjeta_planes
SET activa = FALSE,
    updated_at = NOW()
WHERE medio_pago = 'mercadopago'
  AND entidad IS NULL
  AND UPPER(TRIM(nombre)) <> 'MERCADOPAGO QR'
  AND activa = TRUE;

UPDATE tarjeta_planes
SET medio_pago = 'mercadopago',
    entidad = NULL,
    cuotas = 1,
    porcentaje_recargo_cliente = 0,
    porcentaje_costo_financiero = 1.10,
    activa = TRUE,
    fecha_desde = NULL,
    fecha_hasta = NULL,
    updated_at = NOW()
WHERE UPPER(TRIM(nombre)) = 'MERCADOPAGO QR';

INSERT INTO tarjeta_planes (
    nombre,
    medio_pago,
    entidad,
    cuotas,
    porcentaje_recargo_cliente,
    porcentaje_costo_financiero,
    activa
)
SELECT
    'MercadoPago QR',
    'mercadopago',
    NULL,
    1,
    0,
    1.10,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM tarjeta_planes
    WHERE UPPER(TRIM(nombre)) = 'MERCADOPAGO QR'
);

COMMIT;
