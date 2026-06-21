-- Repara ventas existentes para que reflejen descuentos/recargos reales
-- ya congelados en pagos confirmados.

WITH resumen AS (
    SELECT
        v.id,
        COALESCE(v.subtotal_base, 0)::numeric(14,2) AS subtotal_base,
        COALESCE(SUM(COALESCE(p.monto_base_aplicado, 0)), 0)::numeric(14,2) AS base_pagada,
        COALESCE(SUM(COALESCE(p.monto_descuento_aplicado, 0)), 0)::numeric(14,2) AS descuento_total,
        COALESCE(SUM(COALESCE(p.monto_recargo_aplicado, 0)), 0)::numeric(14,2) AS recargo_total
    FROM ventas v
    INNER JOIN pagos p
        ON p.origen_tipo = 'venta'
       AND p.origen_id = v.id
       AND p.estado = 'confirmado'
    WHERE v.estado IN ('creada', 'pagada_parcial', 'pagada_total')
    GROUP BY v.id, v.subtotal_base
), calculo AS (
    SELECT
        id,
        descuento_total,
        recargo_total,
        GREATEST(subtotal_base - descuento_total + recargo_total, 0)::numeric(14,2) AS total_final,
        CASE
            WHEN ABS(subtotal_base - base_pagada) <= 0.01 THEN 0
            ELSE GREATEST(subtotal_base - base_pagada, 0)
        END::numeric(14,2) AS saldo_pendiente,
        CASE
            WHEN base_pagada <= 0 THEN 'creada'
            WHEN ABS(subtotal_base - base_pagada) <= 0.01 THEN 'pagada_total'
            ELSE 'pagada_parcial'
        END AS estado
    FROM resumen
)
UPDATE ventas v
SET descuento_total = c.descuento_total,
    recargo_total = c.recargo_total,
    total_final = c.total_final,
    saldo_pendiente = c.saldo_pendiente,
    estado = c.estado,
    updated_at = NOW()
FROM calculo c
WHERE v.id = c.id;
