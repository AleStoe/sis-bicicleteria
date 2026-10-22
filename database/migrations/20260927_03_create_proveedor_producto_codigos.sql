CREATE TABLE IF NOT EXISTS proveedor_producto_codigos (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    codigo_proveedor VARCHAR(100) NOT NULL,
    id_variante INTEGER NOT NULL REFERENCES variantes(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedor_producto_codigo
ON proveedor_producto_codigos (id_proveedor, UPPER(TRIM(codigo_proveedor)));

CREATE INDEX IF NOT EXISTS idx_proveedor_producto_codigos_variante
ON proveedor_producto_codigos (id_variante)
WHERE activo = TRUE;
