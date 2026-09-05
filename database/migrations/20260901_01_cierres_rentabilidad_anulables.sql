ALTER TABLE cierres_rentabilidad
    DROP CONSTRAINT IF EXISTS uq_cierres_rentabilidad_periodo_sucursal;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cierres_rentabilidad_periodo_sucursal_cerrado
    ON cierres_rentabilidad (periodo_mes, COALESCE(id_sucursal, 0))
    WHERE estado = 'cerrado';
