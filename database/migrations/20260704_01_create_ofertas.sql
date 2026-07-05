BEGIN;

CREATE TABLE IF NOT EXISTS ofertas (
    id BIGSERIAL PRIMARY KEY,
    id_variante BIGINT NOT NULL REFERENCES variantes(id),
    nombre VARCHAR(120) NOT NULL,
    precio_regular_referencia NUMERIC(14,2) NOT NULL,
    precio_oferta NUMERIC(14,2) NOT NULL,
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    motivo TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creador BIGINT NOT NULL REFERENCES usuarios(id),
    id_usuario_actualizador BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ofertas_precios_positivos CHECK (
        precio_regular_referencia > 0
        AND precio_oferta > 0
        AND precio_oferta < precio_regular_referencia
    ),
    CONSTRAINT chk_ofertas_vigencia CHECK (fecha_hasta >= fecha_desde)
);

CREATE INDEX IF NOT EXISTS idx_ofertas_variante_vigencia
    ON ofertas (id_variante, activa, fecha_desde, fecha_hasta);

ALTER TABLE venta_items
    ADD COLUMN IF NOT EXISTS id_oferta BIGINT REFERENCES ofertas(id),
    ADD COLUMN IF NOT EXISTS precio_catalogo_original NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS descuento_oferta_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS oferta_nombre_snapshot VARCHAR(120);

ALTER TABLE venta_items
    DROP CONSTRAINT IF EXISTS chk_venta_items_descuento_oferta;

ALTER TABLE venta_items
    ADD CONSTRAINT chk_venta_items_descuento_oferta
    CHECK (
        descuento_oferta_unitario >= 0
        AND (
            id_oferta IS NULL
            OR (
                precio_catalogo_original IS NOT NULL
                AND precio_catalogo_original > precio_lista
                AND descuento_oferta_unitario =
                    precio_catalogo_original - precio_lista
                AND NULLIF(TRIM(oferta_nombre_snapshot), '') IS NOT NULL
            )
        )
    );

INSERT INTO permisos (codigo, descripcion)
VALUES ('gestionar_ofertas', 'Crear, editar y activar ofertas comerciales')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('administrador', 'encargado')
  AND p.codigo = 'gestionar_ofertas'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
