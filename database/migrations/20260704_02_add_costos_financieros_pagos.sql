BEGIN;

ALTER TABLE pagos
    ADD COLUMN IF NOT EXISTS id_plan_financiero BIGINT,
    ADD COLUMN IF NOT EXISTS porcentaje_costo_financiero_aplicado NUMERIC(10,4)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monto_costo_financiero NUMERIC(14,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monto_neto_liquidado NUMERIC(14,2)
        NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pagos_id_plan_financiero_fkey'
    ) THEN
        ALTER TABLE pagos
            ADD CONSTRAINT pagos_id_plan_financiero_fkey
            FOREIGN KEY (id_plan_financiero)
            REFERENCES tarjeta_planes(id);
    END IF;
END
$$;

UPDATE pagos p
SET
    id_plan_financiero = COALESCE(
        p.id_plan_financiero,
        detalle.id_tarjeta_plan
    ),
    monto_neto_liquidado = CASE
        WHEN p.monto_neto_liquidado > 0 THEN p.monto_neto_liquidado
        WHEN detalle.monto_neto_liquidado IS NOT NULL
            THEN detalle.monto_neto_liquidado
        ELSE p.monto_total_cobrado
    END,
    monto_costo_financiero = CASE
        WHEN p.monto_costo_financiero > 0 THEN p.monto_costo_financiero
        WHEN detalle.monto_neto_liquidado IS NOT NULL
            THEN GREATEST(
                p.monto_total_cobrado - detalle.monto_neto_liquidado,
                0
            )
        ELSE 0
    END,
    porcentaje_costo_financiero_aplicado = CASE
        WHEN p.porcentaje_costo_financiero_aplicado > 0
            THEN p.porcentaje_costo_financiero_aplicado
        WHEN detalle.monto_neto_liquidado IS NOT NULL
             AND p.monto_total_cobrado > 0
            THEN ROUND(
                (
                    GREATEST(
                        p.monto_total_cobrado - detalle.monto_neto_liquidado,
                        0
                    )
                    / p.monto_total_cobrado
                    * 100
                )::numeric,
                4
            )
        ELSE 0
    END
FROM pagos_tarjeta_detalle detalle
WHERE detalle.id_pago = p.id;

UPDATE pagos
SET monto_neto_liquidado = monto_total_cobrado
WHERE monto_neto_liquidado = 0
  AND monto_total_cobrado > 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_pagos_costo_financiero_no_negativo'
    ) THEN
        ALTER TABLE pagos
            ADD CONSTRAINT chk_pagos_costo_financiero_no_negativo
            CHECK (
                porcentaje_costo_financiero_aplicado >= 0
                AND monto_costo_financiero >= 0
                AND monto_neto_liquidado >= 0
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_pagos_plan_financiero
    ON pagos(id_plan_financiero);

COMMIT;
