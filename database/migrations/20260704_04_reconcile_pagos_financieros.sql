BEGIN;

-- pagos es la fuente financiera oficial. El costo siempre surge de bruto - neto.
UPDATE pagos
SET
    monto_costo_financiero = GREATEST(
        monto_total_cobrado - monto_neto_liquidado,
        0
    ),
    porcentaje_costo_financiero_aplicado = CASE
        WHEN monto_total_cobrado > 0 THEN ROUND(
            (
                GREATEST(
                    monto_total_cobrado - monto_neto_liquidado,
                    0
                )
                / monto_total_cobrado
                * 100
            )::numeric,
            4
        )
        ELSE 0
    END
WHERE monto_costo_financiero IS DISTINCT FROM GREATEST(
        monto_total_cobrado - monto_neto_liquidado,
        0
    )
   OR porcentaje_costo_financiero_aplicado IS DISTINCT FROM CASE
        WHEN monto_total_cobrado > 0 THEN ROUND(
            (
                GREATEST(
                    monto_total_cobrado - monto_neto_liquidado,
                    0
                )
                / monto_total_cobrado
                * 100
            )::numeric,
            4
        )
        ELSE 0
    END;

-- El detalle de tarjeta queda como snapshot auxiliar y se alinea a pagos.
UPDATE pagos_tarjeta_detalle d
SET monto_neto_liquidado = p.monto_neto_liquidado
FROM pagos p
WHERE p.id = d.id_pago
  AND d.monto_neto_liquidado IS DISTINCT FROM p.monto_neto_liquidado;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_pagos_neto_no_supera_bruto'
    ) THEN
        ALTER TABLE pagos
            ADD CONSTRAINT chk_pagos_neto_no_supera_bruto
            CHECK (monto_neto_liquidado <= monto_total_cobrado);
    END IF;
END
$$;

COMMIT;
