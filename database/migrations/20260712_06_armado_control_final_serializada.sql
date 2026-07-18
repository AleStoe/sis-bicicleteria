ALTER TABLE armado_ordenes
DROP CONSTRAINT IF EXISTS chk_armado_orden_estado;

ALTER TABLE armado_ordenes
ADD CONSTRAINT chk_armado_orden_estado CHECK (
    estado IN (
        'borrador',
        'pendiente_componentes',
        'lista_para_armar',
        'en_armado',
        'control_final',
        'terminada',
        'cancelada'
    )
);

ALTER TABLE armado_ordenes
ADD COLUMN IF NOT EXISTS id_bicicleta_serializada_resultante bigint,
ADD COLUMN IF NOT EXISTS costo_componentes_final numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_adicional_final numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_fabricacion_final numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS desvio_total numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fecha_control_final timestamptz,
ADD COLUMN IF NOT EXISTS fecha_finalizacion timestamptz,
ADD COLUMN IF NOT EXISTS id_usuario_control_final bigint REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS id_usuario_finalizacion bigint REFERENCES usuarios(id);

ALTER TABLE armado_orden_costos
ADD COLUMN IF NOT EXISTS costo_unitario_final numeric(14,4),
ADD COLUMN IF NOT EXISTS total_final numeric(14,4),
ADD COLUMN IF NOT EXISTS fecha_confirmacion_final timestamptz,
ADD COLUMN IF NOT EXISTS id_usuario_confirmacion_final bigint REFERENCES usuarios(id);

ALTER TABLE armado_orden_costos
DROP CONSTRAINT IF EXISTS chk_armado_orden_costos_final_no_negativo;

ALTER TABLE armado_orden_costos
ADD CONSTRAINT chk_armado_orden_costos_final_no_negativo CHECK (
    ((costo_unitario_final IS NULL) OR (costo_unitario_final >= 0))
    AND ((total_final IS NULL) OR (total_final >= 0))
);

CREATE TABLE IF NOT EXISTS armado_orden_controles (
    id bigserial PRIMARY KEY,
    id_orden bigint NOT NULL REFERENCES armado_ordenes(id) ON DELETE CASCADE,
    codigo_control varchar(80) NOT NULL,
    aprobado boolean NOT NULL DEFAULT FALSE,
    observaciones text,
    id_usuario bigint REFERENCES usuarios(id),
    fecha_control timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ux_armado_orden_controles_codigo UNIQUE (id_orden, codigo_control)
);

ALTER TABLE bicicletas_serializadas
ADD COLUMN IF NOT EXISTS id_orden_armado_origen bigint,
ADD COLUMN IF NOT EXISTS costo_fabricacion_final numeric(14,4),
ADD COLUMN IF NOT EXISTS fecha_fabricacion timestamptz,
ADD COLUMN IF NOT EXISTS id_usuario_fabricacion bigint REFERENCES usuarios(id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_bicicletas_serializadas_orden_armado_origen'
    ) THEN
        ALTER TABLE bicicletas_serializadas
        ADD CONSTRAINT fk_bicicletas_serializadas_orden_armado_origen
        FOREIGN KEY (id_orden_armado_origen)
        REFERENCES armado_ordenes(id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bicicletas_serializadas_orden_armado_origen
ON bicicletas_serializadas(id_orden_armado_origen)
WHERE id_orden_armado_origen IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_armado_ordenes_bicicleta_resultante'
    ) THEN
        ALTER TABLE armado_ordenes
        ADD CONSTRAINT fk_armado_ordenes_bicicleta_resultante
        FOREIGN KEY (id_bicicleta_serializada_resultante)
        REFERENCES bicicletas_serializadas(id);
    END IF;
END $$;
