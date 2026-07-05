BEGIN;

ALTER TABLE cierres_rentabilidad
    ADD COLUMN IF NOT EXISTS financiacion_cobrada NUMERIC(14,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costos_financieros NUMERIC(14,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resultado_financiero NUMERIC(14,2)
        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS margen_real NUMERIC(14,2)
        NOT NULL DEFAULT 0;

-- Los cierres históricos no tenían costos financieros separados.
UPDATE cierres_rentabilidad
SET margen_real = margen_bruto
WHERE margen_real = 0
  AND margen_bruto <> 0;

COMMIT;
