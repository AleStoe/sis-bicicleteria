CREATE TABLE IF NOT EXISTS recepcion_documentos (
    id SERIAL PRIMARY KEY,
    id_recepcion INTEGER NOT NULL
        REFERENCES recepciones_mercaderia(id) ON DELETE CASCADE,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_guardado VARCHAR(255) NOT NULL,
    ruta_relativa VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150),
    extension VARCHAR(20) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL UNIQUE,
    estado VARCHAR(30) NOT NULL,
    extractor VARCHAR(80),
    texto_extraido TEXT,
    metadata_extraida JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_extraccion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recepcion_documento_estado CHECK (
        estado IN ('extraido', 'requiere_revision', 'pendiente_ocr', 'error')
    ),
    CONSTRAINT chk_recepcion_documento_tamano CHECK (tamano_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_recepcion_documentos_recepcion
ON recepcion_documentos (id_recepcion, created_at DESC);
