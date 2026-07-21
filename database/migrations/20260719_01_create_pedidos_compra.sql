CREATE TABLE IF NOT EXISTS pedidos_compra (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    proveedor_nombre_snapshot VARCHAR(150) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_envio TIMESTAMPTZ,
    fecha_cierre TIMESTAMPTZ,
    observaciones TEXT,
    id_usuario_creador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pedidos_compra_estado
        CHECK (estado IN ('borrador', 'enviado', 'recibido_parcial', 'cerrado'))
);

CREATE TABLE IF NOT EXISTS pedido_compra_items (
    id SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
    id_variante INTEGER REFERENCES variantes(id) ON DELETE SET NULL,
    producto_nombre_snapshot TEXT NOT NULL,
    variante_nombre_snapshot TEXT,
    sku_snapshot VARCHAR(100),
    codigo_proveedor_snapshot VARCHAR(100),
    stock_disponible_al_crear NUMERIC(14,3) NOT NULL DEFAULT 0,
    cantidad_sugerida NUMERIC(14,3) NOT NULL DEFAULT 0,
    cantidad_pedida NUMERIC(14,3) NOT NULL,
    cantidad_recibida NUMERIC(14,3) NOT NULL DEFAULT 0,
    observacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_pedido_compra_item_cantidad_pedida
        CHECK (cantidad_pedida > 0),
    CONSTRAINT chk_pedido_compra_item_cantidad_recibida
        CHECK (cantidad_recibida >= 0)
);

CREATE TABLE IF NOT EXISTS pedido_compra_historial (
    id SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
    accion VARCHAR(50) NOT NULL,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30),
    detalle TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    id_usuario INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_estado
ON pedidos_compra (estado);

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_proveedor
ON pedidos_compra (id_proveedor);

CREATE INDEX IF NOT EXISTS idx_pedido_compra_items_pedido
ON pedido_compra_items (id_pedido);

CREATE INDEX IF NOT EXISTS idx_pedido_compra_items_variante
ON pedido_compra_items (id_variante);

CREATE INDEX IF NOT EXISTS idx_pedido_compra_historial_pedido
ON pedido_compra_historial (id_pedido, fecha DESC);
