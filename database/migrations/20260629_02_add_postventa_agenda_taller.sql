ALTER TABLE agenda_taller
    ADD COLUMN IF NOT EXISTS tipo_turno VARCHAR(40) NOT NULL DEFAULT 'reparacion_comun',
    ADD COLUMN IF NOT EXISTS id_venta_origen BIGINT;

UPDATE agenda_taller
SET tipo_turno = 'reparacion_comun'
WHERE tipo_turno IS NULL OR TRIM(tipo_turno) = '';

ALTER TABLE agenda_taller
    DROP CONSTRAINT IF EXISTS chk_agenda_taller_tipo_turno;

ALTER TABLE agenda_taller
    ADD CONSTRAINT chk_agenda_taller_tipo_turno
    CHECK (
        tipo_turno IN (
            'reparacion_comun',
            'service_postventa_30_dias',
            'garantia',
            'consulta_revision'
        )
    );

ALTER TABLE agenda_taller
    DROP CONSTRAINT IF EXISTS agenda_taller_id_venta_origen_fkey;

ALTER TABLE agenda_taller
    ADD CONSTRAINT agenda_taller_id_venta_origen_fkey
    FOREIGN KEY (id_venta_origen) REFERENCES ventas(id);

CREATE INDEX IF NOT EXISTS idx_agenda_taller_bicicleta_tipo
    ON agenda_taller (id_bicicleta_cliente, tipo_turno);

CREATE INDEX IF NOT EXISTS idx_agenda_taller_venta_origen
    ON agenda_taller (id_venta_origen);
