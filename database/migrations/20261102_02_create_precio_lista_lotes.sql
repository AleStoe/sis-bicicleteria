BEGIN;

CREATE TABLE IF NOT EXISTS precio_lista_perfiles (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    formato VARCHAR(20) NOT NULL,
    hoja VARCHAR(150),
    fila_encabezado INTEGER NOT NULL,
    delimitador VARCHAR(10),
    codificacion VARCHAR(40),
    mapeo_columnas JSONB NOT NULL DEFAULT '{}'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    id_usuario_creador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_precio_lista_perfil_nombre UNIQUE (id_proveedor, nombre),
    CONSTRAINT chk_precio_lista_perfil_formato CHECK (formato IN ('xlsx', 'csv', 'txt')),
    CONSTRAINT chk_precio_lista_perfil_encabezado CHECK (fila_encabezado > 0)
);

CREATE TABLE IF NOT EXISTS precio_lista_lotes (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    proveedor_nombre_snapshot VARCHAR(150) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
    nombre_archivo VARCHAR(255) NOT NULL,
    formato VARCHAR(20) NOT NULL,
    hoja_detectada VARCHAR(150),
    fila_encabezado_detectada INTEGER,
    delimitador_detectado VARCHAR(10),
    codificacion_detectada VARCHAR(40),
    encabezados JSONB NOT NULL DEFAULT '[]'::jsonb,
    mapeo_detectado JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_filas INTEGER NOT NULL DEFAULT 0,
    observaciones TEXT,
    error_lectura TEXT,
    id_perfil INTEGER REFERENCES precio_lista_perfiles(id) ON DELETE SET NULL,
    id_usuario_creador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    anulado_at TIMESTAMPTZ,
    anulado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_anulacion VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_precio_lista_lote_estado CHECK (
        estado IN ('borrador', 'requiere_revision', 'listo_para_revisar', 'anulado', 'error')
    ),
    CONSTRAINT chk_precio_lista_lote_formato CHECK (formato IN ('xlsx', 'csv', 'txt')),
    CONSTRAINT chk_precio_lista_lote_total_filas CHECK (total_filas >= 0)
);

CREATE TABLE IF NOT EXISTS precio_lista_documentos (
    id SERIAL PRIMARY KEY,
    id_lote INTEGER NOT NULL REFERENCES precio_lista_lotes(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_guardado VARCHAR(255) NOT NULL,
    ruta_relativa VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150),
    extension VARCHAR(20) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL UNIQUE,
    extractor VARCHAR(80) NOT NULL,
    metadata_lectura JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_precio_lista_documento_tamano CHECK (tamano_bytes > 0)
);

CREATE TABLE IF NOT EXISTS precio_lista_items (
    id SERIAL PRIMARY KEY,
    id_lote INTEGER NOT NULL REFERENCES precio_lista_lotes(id) ON DELETE CASCADE,
    numero_fila INTEGER NOT NULL,
    valores_originales JSONB NOT NULL DEFAULT '[]'::jsonb,
    linea_original TEXT,
    codigo_original TEXT,
    descripcion_original TEXT,
    costo_original TEXT,
    cantidad_original TEXT,
    moneda_original TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'leida',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_precio_lista_item_fila UNIQUE (id_lote, numero_fila),
    CONSTRAINT chk_precio_lista_item_estado CHECK (estado IN ('leida', 'incompleta', 'ignorada'))
);

CREATE INDEX IF NOT EXISTS idx_precio_lista_lotes_estado
ON precio_lista_lotes (estado, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_precio_lista_lotes_proveedor
ON precio_lista_lotes (id_proveedor, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_precio_lista_items_lote
ON precio_lista_items (id_lote, numero_fila);

CREATE INDEX IF NOT EXISTS idx_precio_lista_perfiles_proveedor
ON precio_lista_perfiles (id_proveedor, activo, updated_at DESC);

COMMIT;
