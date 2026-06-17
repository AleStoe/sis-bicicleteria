BEGIN;

ALTER TABLE movimientos_stock
DROP CONSTRAINT IF EXISTS chk_movimientos_stock_origen_tipo;

ALTER TABLE movimientos_stock
ADD CONSTRAINT chk_movimientos_stock_origen_tipo
CHECK (
    origen_tipo IN (
        'ingreso_stock',
        'venta',
        'reserva',
        'orden_taller',
        'ajuste_manual',
        'devolucion_venta',
        'transferencia',
        'bicicleta_serializada',
        'inventario_fisico'
    )
);

CREATE TABLE IF NOT EXISTS inventarios_fisicos (
    id bigserial PRIMARY KEY,
    id_sucursal bigint NOT NULL REFERENCES sucursales(id),
    estado varchar(20) NOT NULL DEFAULT 'abierto',
    descripcion varchar(200),
    id_usuario_creador bigint NOT NULL REFERENCES usuarios(id),
    id_usuario_cierre bigint REFERENCES usuarios(id),
    fecha_inicio timestamptz NOT NULL DEFAULT now(),
    fecha_cierre timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_inventarios_fisicos_estado
        CHECK (estado IN ('abierto', 'cerrado', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS inventario_fisico_items (
    id bigserial PRIMARY KEY,
    id_inventario bigint NOT NULL REFERENCES inventarios_fisicos(id) ON DELETE CASCADE,
    id_variante bigint NOT NULL REFERENCES variantes(id),
    stock_sistema numeric(14,3) NOT NULL DEFAULT 0,
    stock_contado numeric(14,3),
    diferencia numeric(14,3) NOT NULL DEFAULT 0,
    nota text,
    contado_at timestamptz,
    id_usuario_conteo bigint REFERENCES usuarios(id),
    movimiento_stock_id bigint REFERENCES movimientos_stock(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_inventario_fisico_item UNIQUE (id_inventario, id_variante),
    CONSTRAINT chk_inventario_fisico_stock_no_negativo
        CHECK (stock_sistema >= 0 AND (stock_contado IS NULL OR stock_contado >= 0))
);

CREATE INDEX IF NOT EXISTS idx_inventarios_fisicos_sucursal_estado
ON inventarios_fisicos (id_sucursal, estado);

CREATE INDEX IF NOT EXISTS idx_inventario_fisico_items_inventario
ON inventario_fisico_items (id_inventario);

COMMIT;
