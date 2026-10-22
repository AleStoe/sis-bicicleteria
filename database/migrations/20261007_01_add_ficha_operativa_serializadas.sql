BEGIN;

ALTER TABLE bicicletas_serializadas
    ADD COLUMN IF NOT EXISTS estado_tecnico VARCHAR(30) NOT NULL DEFAULT 'lista',
    ADD COLUMN IF NOT EXISTS condicion_comercial VARCHAR(30) NOT NULL DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS ubicacion_fisica VARCHAR(120),
    ADD COLUMN IF NOT EXISTS costo_base_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_base_origen VARCHAR(40) NOT NULL DEFAULT 'migracion_costo_promedio',
    ADD COLUMN IF NOT EXISTS costo_acondicionamiento NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_total_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS texto_comercial VARCHAR(500),
    ADD COLUMN IF NOT EXISTS fecha_revision_tecnica TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS id_usuario_revision_tecnica BIGINT REFERENCES usuarios(id);

ALTER TABLE bicicletas_serializadas
    DROP CONSTRAINT IF EXISTS chk_bicicletas_serializadas_estado_tecnico,
    DROP CONSTRAINT IF EXISTS chk_bicicletas_serializadas_condicion_comercial,
    DROP CONSTRAINT IF EXISTS chk_bicicletas_serializadas_costos_individuales;

ALTER TABLE bicicletas_serializadas
    ADD CONSTRAINT chk_bicicletas_serializadas_estado_tecnico
        CHECK (estado_tecnico IN ('pendiente_revision', 'en_acondicionamiento', 'lista', 'bloqueada')),
    ADD CONSTRAINT chk_bicicletas_serializadas_condicion_comercial
        CHECK (condicion_comercial IN ('normal', 'reacondicionada', 'oferta')),
    ADD CONSTRAINT chk_bicicletas_serializadas_costos_individuales
        CHECK (
            costo_base_unitario >= 0
            AND costo_acondicionamiento >= 0
            AND costo_total_unitario >= 0
        );

UPDATE bicicletas_serializadas bs
SET
    costo_base_unitario = ROUND(
        CASE
            WHEN bs.id_orden_armado_origen IS NOT NULL
                 AND bs.costo_fabricacion_final IS NOT NULL
                THEN bs.costo_fabricacion_final
            ELSE COALESCE(v.costo_promedio_vigente, 0)
        END,
        2
    ),
    costo_total_unitario = ROUND(
        CASE
            WHEN bs.id_orden_armado_origen IS NOT NULL
                 AND bs.costo_fabricacion_final IS NOT NULL
                THEN bs.costo_fabricacion_final
            ELSE COALESCE(v.costo_promedio_vigente, 0)
        END,
        2
    ),
    costo_base_origen = CASE
        WHEN bs.id_orden_armado_origen IS NOT NULL
             AND bs.costo_fabricacion_final IS NOT NULL
            THEN 'fabricacion_propia'
        ELSE 'migracion_costo_promedio'
    END
FROM variantes v
WHERE v.id = bs.id_variante
  AND bs.costo_base_unitario = 0
  AND bs.costo_total_unitario = 0;

CREATE INDEX IF NOT EXISTS idx_bicicletas_serializadas_disponibilidad_tecnica
    ON bicicletas_serializadas (id_variante, id_sucursal_actual, estado, estado_tecnico);

COMMIT;
