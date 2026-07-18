BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'armado_configuraciones'
          AND column_name = 'numero_version'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'armado_configuraciones'
          AND column_name = 'numero_revision'
    ) THEN
        ALTER TABLE armado_configuraciones
            RENAME COLUMN numero_version TO numero_revision;
    END IF;
END $$;

ALTER TABLE armado_configuraciones
    DROP CONSTRAINT IF EXISTS chk_armado_config_numero;

ALTER TABLE armado_configuraciones
    DROP CONSTRAINT IF EXISTS uq_armado_config_version_numero;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_armado_config_numero_revision'
    ) THEN
        ALTER TABLE armado_configuraciones
            ADD CONSTRAINT chk_armado_config_numero_revision CHECK (numero_revision > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_armado_config_version_revision'
    ) THEN
        ALTER TABLE armado_configuraciones
            ADD CONSTRAINT uq_armado_config_version_revision UNIQUE (id_version, numero_revision);
    END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS armado_orden_codigo_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS armado_ordenes (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE
        DEFAULT ('OA-' || LPAD(nextval('armado_orden_codigo_seq')::text, 6, '0')),
    id_modelo BIGINT NOT NULL REFERENCES armado_modelos(id) ON DELETE RESTRICT,
    id_version BIGINT NOT NULL REFERENCES armado_versiones(id) ON DELETE RESTRICT,
    id_configuracion BIGINT NOT NULL REFERENCES armado_configuraciones(id) ON DELETE RESTRICT,
    id_sucursal BIGINT NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
    talle VARCHAR(80),
    color VARCHAR(120),
    numero_cuadro VARCHAR(120),
    descripcion_final TEXT,
    id_usuario_responsable BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    id_usuario_creacion BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    costo_componentes_previsto NUMERIC(14,2) NOT NULL DEFAULT 0,
    costo_adicional_previsto NUMERIC(14,2) NOT NULL DEFAULT 0,
    costo_total_previsto NUMERIC(14,2) NOT NULL DEFAULT 0,
    precio_objetivo NUMERIC(14,2),
    margen_objetivo NUMERIC(8,2),
    observaciones TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cancelacion TIMESTAMPTZ,
    CONSTRAINT chk_armado_orden_estado CHECK (
        estado IN ('borrador', 'pendiente_componentes', 'lista_para_armar', 'cancelada')
    ),
    CONSTRAINT chk_armado_orden_costos CHECK (
        costo_componentes_previsto >= 0
        AND costo_adicional_previsto >= 0
        AND costo_total_previsto >= 0
        AND (precio_objetivo IS NULL OR precio_objetivo >= 0)
        AND (margen_objetivo IS NULL OR (margen_objetivo >= 0 AND margen_objetivo < 100))
    )
);

ALTER SEQUENCE armado_orden_codigo_seq OWNED BY armado_ordenes.codigo;

CREATE INDEX IF NOT EXISTS idx_armado_ordenes_estado
    ON armado_ordenes(estado);

CREATE INDEX IF NOT EXISTS idx_armado_ordenes_configuracion
    ON armado_ordenes(id_configuracion);

CREATE INDEX IF NOT EXISTS idx_armado_ordenes_sucursal
    ON armado_ordenes(id_sucursal);

CREATE TABLE IF NOT EXISTS armado_orden_items (
    id BIGSERIAL PRIMARY KEY,
    id_orden BIGINT NOT NULL REFERENCES armado_ordenes(id) ON DELETE CASCADE,
    id_configuracion_item_origen BIGINT REFERENCES armado_configuracion_items(id) ON DELETE SET NULL,
    grupo VARCHAR(80),
    id_variante_prevista BIGINT NOT NULL REFERENCES variantes(id) ON DELETE RESTRICT,
    id_variante_utilizada BIGINT NOT NULL REFERENCES variantes(id) ON DELETE RESTRICT,
    cantidad_prevista NUMERIC(14,3) NOT NULL,
    cantidad_utilizada NUMERIC(14,3) NOT NULL,
    costo_unitario_previsto NUMERIC(14,4),
    subtotal_previsto NUMERIC(14,2),
    es_sustitucion BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_sustitucion TEXT,
    id_usuario_sustitucion BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_sustitucion TIMESTAMPTZ,
    observaciones TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_armado_orden_items_cantidades CHECK (
        cantidad_prevista > 0 AND cantidad_utilizada > 0
    ),
    CONSTRAINT chk_armado_orden_items_costos CHECK (
        (costo_unitario_previsto IS NULL OR costo_unitario_previsto >= 0)
        AND (subtotal_previsto IS NULL OR subtotal_previsto >= 0)
    ),
    CONSTRAINT chk_armado_orden_items_estado CHECK (
        estado IN ('pendiente', 'disponible', 'faltante', 'sustituido', 'omitido')
    )
);

CREATE INDEX IF NOT EXISTS idx_armado_orden_items_orden
    ON armado_orden_items(id_orden);

CREATE INDEX IF NOT EXISTS idx_armado_orden_items_utilizada
    ON armado_orden_items(id_variante_utilizada);

CREATE TABLE IF NOT EXISTS armado_orden_costos (
    id BIGSERIAL PRIMARY KEY,
    id_orden BIGINT NOT NULL REFERENCES armado_ordenes(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    descripcion VARCHAR(220) NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL DEFAULT 1,
    costo_unitario NUMERIC(14,2) NOT NULL,
    total NUMERIC(14,2) NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_armado_orden_costos_tipo CHECK (
        tipo IN ('mano_obra', 'consumible_no_inventariado', 'trabajo_externo', 'otro')
    ),
    CONSTRAINT chk_armado_orden_costos_montos CHECK (
        cantidad > 0 AND costo_unitario >= 0 AND total >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_armado_orden_costos_orden
    ON armado_orden_costos(id_orden);

COMMIT;
