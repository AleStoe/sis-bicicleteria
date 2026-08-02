ALTER TABLE capital_movimientos_historial
DROP CONSTRAINT IF EXISTS chk_capital_historial_tipo;

ALTER TABLE capital_movimientos_historial
ADD CONSTRAINT chk_capital_historial_tipo
CHECK (
    tipo_evento IN (
        'creacion',
        'anulacion',
        'correccion_caja',
        'validacion_sin_caja'
    )
);
