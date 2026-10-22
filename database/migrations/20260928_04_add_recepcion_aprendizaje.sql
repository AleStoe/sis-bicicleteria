BEGIN;

CREATE TABLE IF NOT EXISTS recepcion_clasificaciones_memoria (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER REFERENCES proveedores(id) ON DELETE CASCADE,
    descripcion_normalizada TEXT NOT NULL,
    id_variante INTEGER REFERENCES variantes(id) ON DELETE SET NULL,
    rubro VARCHAR(80),
    id_categoria INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    id_marca INTEGER REFERENCES marcas(id) ON DELETE SET NULL,
    subtipo VARCHAR(80),
    confirmaciones INTEGER NOT NULL DEFAULT 1,
    ultima_recepcion_id INTEGER REFERENCES recepciones_mercaderia(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_recepcion_memoria_proveedor_descripcion
        UNIQUE (id_proveedor, descripcion_normalizada)
);

CREATE INDEX IF NOT EXISTS idx_recepcion_memoria_descripcion
ON recepcion_clasificaciones_memoria (descripcion_normalizada);

CREATE TABLE IF NOT EXISTS recepcion_formatos_proveedor (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(30) NOT NULL,
    extension VARCHAR(20) NOT NULL,
    extractor VARCHAR(80) NOT NULL,
    documentos_procesados INTEGER NOT NULL DEFAULT 1,
    documentos_con_error INTEGER NOT NULL DEFAULT 0,
    correcciones_manuales INTEGER NOT NULL DEFAULT 0,
    confianza_promedio NUMERIC(7,4),
    ultimo_documento_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_recepcion_formato_proveedor
        UNIQUE (id_proveedor, tipo_documento, extension, extractor)
);

CREATE TABLE IF NOT EXISTS recepcion_sugerencias_regla (
    id SERIAL PRIMARY KEY,
    id_proveedor INTEGER REFERENCES proveedores(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    motivo TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    ocurrencias INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recepcion_sugerencia_estado
        CHECK (estado IN ('pendiente', 'aceptada', 'descartada')),
    CONSTRAINT uq_recepcion_sugerencia_regla
        UNIQUE (id_proveedor, tipo, titulo)
);

ALTER TABLE recepciones_mercaderia
ADD COLUMN IF NOT EXISTS total_correcciones INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS coincidencias_automaticas INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS coincidencias_sugeridas INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS coincidencias_rechazadas INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS duplicados_detectados INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS alertas_costo INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS procesamiento_iniciado_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS origen_resolucion VARCHAR(30) NOT NULL DEFAULT 'reglas',
ADD COLUMN IF NOT EXISTS id_memoria_clasificacion INTEGER REFERENCES recepcion_clasificaciones_memoria(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS posible_duplicado BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS duplicado_candidatos JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS variacion_costo_pct NUMERIC(9,2),
ADD COLUMN IF NOT EXISTS alerta_costo VARCHAR(300);

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_origen_resolucion;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_origen_resolucion CHECK (
    origen_resolucion IN (
        'codigo_proveedor', 'ean', 'codigo_otro_proveedor',
        'memoria_sugerida', 'descripcion_sugerida', 'reglas', 'manual'
    )
);

COMMIT;
