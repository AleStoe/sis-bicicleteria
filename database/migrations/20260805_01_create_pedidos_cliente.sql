CREATE TABLE IF NOT EXISTS pedidos_cliente (
    id SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES clientes(id),
    id_sucursal INTEGER NOT NULL REFERENCES sucursales(id),
    tipo_precio VARCHAR(20) NOT NULL DEFAULT 'minorista',
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_conversion TIMESTAMPTZ,
    fecha_cancelacion TIMESTAMPTZ,
    id_venta_generada INTEGER UNIQUE REFERENCES ventas(id) ON DELETE SET NULL,
    observaciones TEXT,
    id_usuario_creador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pedidos_cliente_tipo_precio
        CHECK (tipo_precio IN ('minorista', 'mayorista')),
    CONSTRAINT chk_pedidos_cliente_estado
        CHECK (estado IN ('borrador', 'convertido_a_venta', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS pedido_cliente_items (
    id SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL REFERENCES pedidos_cliente(id) ON DELETE CASCADE,
    id_variante INTEGER NOT NULL REFERENCES variantes(id),
    producto_nombre_snapshot TEXT NOT NULL,
    variante_nombre_snapshot TEXT,
    sku_snapshot VARCHAR(100),
    codigo_barras_snapshot VARCHAR(100),
    codigo_proveedor_snapshot VARCHAR(100),
    precio_minorista_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
    precio_mayorista_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0,
    cantidad NUMERIC(14,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pedido_cliente_item_cantidad
        CHECK (cantidad > 0),
    CONSTRAINT uq_pedido_cliente_item_variante
        UNIQUE (id_pedido, id_variante)
);

CREATE TABLE IF NOT EXISTS pedido_cliente_historial (
    id SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL REFERENCES pedidos_cliente(id) ON DELETE CASCADE,
    accion VARCHAR(60) NOT NULL,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30),
    detalle TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    id_usuario INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_estado
ON pedidos_cliente (estado);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_cliente
ON pedidos_cliente (id_cliente);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_sucursal
ON pedidos_cliente (id_sucursal);

CREATE INDEX IF NOT EXISTS idx_pedido_cliente_items_pedido
ON pedido_cliente_items (id_pedido);

CREATE INDEX IF NOT EXISTS idx_pedido_cliente_items_variante
ON pedido_cliente_items (id_variante);

CREATE INDEX IF NOT EXISTS idx_pedido_cliente_historial_pedido
ON pedido_cliente_historial (id_pedido, fecha DESC);
