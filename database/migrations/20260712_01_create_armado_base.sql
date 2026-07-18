BEGIN;

CREATE TABLE IF NOT EXISTS armado_modelos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creador BIGINT NOT NULL REFERENCES usuarios(id),
    id_usuario_actualizador BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_armado_modelos_nombre CHECK (length(trim(nombre)) > 0)
);

CREATE TABLE IF NOT EXISTS armado_versiones (
    id BIGSERIAL PRIMARY KEY,
    id_modelo BIGINT NOT NULL REFERENCES armado_modelos(id) ON DELETE RESTRICT,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    id_variante_final BIGINT NOT NULL REFERENCES variantes(id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creador BIGINT NOT NULL REFERENCES usuarios(id),
    id_usuario_actualizador BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_armado_versiones_nombre CHECK (length(trim(nombre)) > 0),
    CONSTRAINT uq_armado_versiones_modelo_nombre UNIQUE (id_modelo, nombre)
);

CREATE INDEX IF NOT EXISTS idx_armado_versiones_modelo
    ON armado_versiones(id_modelo);

CREATE INDEX IF NOT EXISTS idx_armado_versiones_variante_final
    ON armado_versiones(id_variante_final);

CREATE TABLE IF NOT EXISTS armado_configuraciones (
    id BIGSERIAL PRIMARY KEY,
    id_version BIGINT NOT NULL REFERENCES armado_versiones(id) ON DELETE RESTRICT,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    numero_revision INTEGER NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    id_configuracion_origen BIGINT REFERENCES armado_configuraciones(id) ON DELETE SET NULL,
    id_usuario_creador BIGINT NOT NULL REFERENCES usuarios(id),
    id_usuario_actualizador BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_armado_config_nombre CHECK (length(trim(nombre)) > 0),
    CONSTRAINT chk_armado_config_numero_revision CHECK (numero_revision > 0),
    CONSTRAINT chk_armado_config_estado CHECK (estado IN ('borrador', 'activa', 'archivada')),
    CONSTRAINT uq_armado_config_version_revision UNIQUE (id_version, numero_revision)
);

CREATE INDEX IF NOT EXISTS idx_armado_configuraciones_version
    ON armado_configuraciones(id_version);

CREATE INDEX IF NOT EXISTS idx_armado_configuraciones_origen
    ON armado_configuraciones(id_configuracion_origen);

CREATE UNIQUE INDEX IF NOT EXISTS uq_armado_config_activa_por_version
    ON armado_configuraciones(id_version)
    WHERE estado = 'activa';

CREATE TABLE IF NOT EXISTS armado_configuracion_items (
    id BIGSERIAL PRIMARY KEY,
    id_configuracion BIGINT NOT NULL REFERENCES armado_configuraciones(id) ON DELETE CASCADE,
    id_variante_componente BIGINT NOT NULL REFERENCES variantes(id) ON DELETE RESTRICT,
    cantidad NUMERIC(14,3) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_armado_config_items_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_armado_config_items_orden CHECK (orden >= 0)
);

CREATE INDEX IF NOT EXISTS idx_armado_config_items_configuracion
    ON armado_configuracion_items(id_configuracion);

CREATE INDEX IF NOT EXISTS idx_armado_config_items_variante
    ON armado_configuracion_items(id_variante_componente);

INSERT INTO permisos (codigo, descripcion)
VALUES (
    'gestionar_armado',
    'Administrar modelos, versiones y configuraciones de armado de bicicletas'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('administrador', 'encargado')
  AND p.codigo = 'gestionar_armado'
ON CONFLICT DO NOTHING;

COMMIT;
