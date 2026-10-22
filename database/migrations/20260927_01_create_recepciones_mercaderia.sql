CREATE TABLE IF NOT EXISTS recepciones_mercaderia (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    proveedor_nombre_snapshot VARCHAR(150) NOT NULL,
    id_sucursal INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
    origen_carga VARCHAR(30) NOT NULL DEFAULT 'tabla_pegada',
    texto_origen TEXT NOT NULL,
    observaciones TEXT,
    total_lineas INTEGER NOT NULL DEFAULT 0,
    total_unidades NUMERIC(14,3) NOT NULL DEFAULT 0,
    total_costo NUMERIC(14,2) NOT NULL DEFAULT 0,
    id_usuario_creador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_recepciones_mercaderia_estado CHECK (
        estado IN (
            'borrador',
            'procesando',
            'requiere_revision',
            'lista_para_confirmar',
            'confirmada',
            'anulada',
            'error'
        )
    ),
    CONSTRAINT chk_recepciones_mercaderia_origen CHECK (
        origen_carga IN ('tabla_pegada', 'csv', 'xlsx', 'documento')
    )
);

CREATE TABLE IF NOT EXISTS recepcion_mercaderia_items (
    id SERIAL PRIMARY KEY,
    id_recepcion INTEGER NOT NULL
        REFERENCES recepciones_mercaderia(id) ON DELETE CASCADE,
    numero_linea INTEGER NOT NULL,
    linea_original TEXT NOT NULL,
    codigo_proveedor VARCHAR(100),
    descripcion_original TEXT,
    descripcion_normalizada TEXT,
    cantidad NUMERIC(14,3),
    costo_unitario NUMERIC(14,2),
    costo_total NUMERIC(14,2),
    estado_resolucion VARCHAR(20) NOT NULL DEFAULT 'incompleta',
    id_variante INTEGER REFERENCES variantes(id) ON DELETE SET NULL,
    mensaje_revision TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_recepcion_mercaderia_numero_linea
        UNIQUE (id_recepcion, numero_linea),
    CONSTRAINT chk_recepcion_item_estado CHECK (
        estado_resolucion IN ('exacta', 'sugerida', 'nueva', 'conflicto', 'incompleta')
    ),
    CONSTRAINT chk_recepcion_item_cantidad CHECK (
        cantidad IS NULL OR cantidad > 0
    ),
    CONSTRAINT chk_recepcion_item_costo CHECK (
        costo_unitario IS NULL OR costo_unitario >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_recepciones_mercaderia_estado
ON recepciones_mercaderia (estado, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recepciones_mercaderia_proveedor
ON recepciones_mercaderia (id_proveedor, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recepcion_mercaderia_items_recepcion
ON recepcion_mercaderia_items (id_recepcion, numero_linea);

CREATE INDEX IF NOT EXISTS idx_recepcion_mercaderia_items_codigo
ON recepcion_mercaderia_items (codigo_proveedor);
