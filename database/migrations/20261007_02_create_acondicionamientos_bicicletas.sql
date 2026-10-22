BEGIN;

CREATE TABLE IF NOT EXISTS bicicleta_acondicionamientos (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(24) UNIQUE,
    id_bicicleta_serializada BIGINT NOT NULL REFERENCES bicicletas_serializadas(id),
    id_sucursal BIGINT NOT NULL REFERENCES sucursales(id),
    estado VARCHAR(24) NOT NULL DEFAULT 'borrador',
    estado_tecnico_anterior VARCHAR(30) NOT NULL,
    motivo VARCHAR(500) NOT NULL,
    observaciones VARCHAR(1000),
    id_usuario_creador BIGINT REFERENCES usuarios(id),
    id_usuario_confirmacion BIGINT REFERENCES usuarios(id),
    id_usuario_reversion BIGINT REFERENCES usuarios(id),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_confirmacion TIMESTAMPTZ,
    fecha_reversion TIMESTAMPTZ,
    motivo_reversion VARCHAR(1000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bicicleta_acondicionamientos_estado
        CHECK (estado IN ('borrador', 'confirmado', 'revertido'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bicicleta_acondicionamiento_activo
    ON bicicleta_acondicionamientos (id_bicicleta_serializada)
    WHERE estado IN ('borrador', 'confirmado');

CREATE INDEX IF NOT EXISTS idx_bicicleta_acondicionamientos_bicicleta
    ON bicicleta_acondicionamientos (id_bicicleta_serializada, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS bicicleta_acondicionamiento_items (
    id BIGSERIAL PRIMARY KEY,
    id_acondicionamiento BIGINT NOT NULL REFERENCES bicicleta_acondicionamientos(id) ON DELETE CASCADE,
    tipo_intervencion VARCHAR(30) NOT NULL,
    id_variante BIGINT NOT NULL REFERENCES variantes(id),
    producto_nombre_snapshot VARCHAR(300) NOT NULL,
    variante_nombre_snapshot VARCHAR(300),
    sku_snapshot VARCHAR(100),
    cantidad NUMERIC(14,3) NOT NULL,
    costo_unitario_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
    stock_disponible_snapshot NUMERIC(14,3) NOT NULL DEFAULT 0,
    detalle_pieza_retirada VARCHAR(500),
    observaciones VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bicicleta_acondicionamiento_item_tipo
        CHECK (tipo_intervencion IN ('reemplazo', 'mejora', 'agregado_incluido')),
    CONSTRAINT chk_bicicleta_acondicionamiento_item_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_bicicleta_acondicionamiento_item_costo CHECK (costo_unitario_estimado >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bicicleta_acondicionamiento_items_orden
    ON bicicleta_acondicionamiento_items (id_acondicionamiento, id);

CREATE TABLE IF NOT EXISTS bicicleta_acondicionamiento_costos (
    id BIGSERIAL PRIMARY KEY,
    id_acondicionamiento BIGINT NOT NULL REFERENCES bicicleta_acondicionamientos(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    descripcion VARCHAR(300) NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL DEFAULT 1,
    costo_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
    observaciones VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bicicleta_acondicionamiento_costo_tipo
        CHECK (tipo IN ('mano_obra', 'consumible_no_inventariado', 'trabajo_externo', 'otro')),
    CONSTRAINT chk_bicicleta_acondicionamiento_costo_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_bicicleta_acondicionamiento_costo_importe CHECK (costo_unitario >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bicicleta_acondicionamiento_costos_orden
    ON bicicleta_acondicionamiento_costos (id_acondicionamiento, id);

CREATE TABLE IF NOT EXISTS bicicleta_acondicionamiento_eventos (
    id BIGSERIAL PRIMARY KEY,
    id_acondicionamiento BIGINT NOT NULL REFERENCES bicicleta_acondicionamientos(id) ON DELETE CASCADE,
    accion VARCHAR(80) NOT NULL,
    detalle VARCHAR(1000),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    id_usuario BIGINT REFERENCES usuarios(id),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bicicleta_acondicionamiento_eventos_orden
    ON bicicleta_acondicionamiento_eventos (id_acondicionamiento, fecha DESC, id DESC);

COMMIT;
