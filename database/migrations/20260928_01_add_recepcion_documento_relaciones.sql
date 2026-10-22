ALTER TABLE recepcion_documentos
ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(30) NOT NULL DEFAULT 'documento',
ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(100),
ADD COLUMN IF NOT EXISTS procesado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS cantidad_reprocesos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE recepcion_documentos
DROP CONSTRAINT IF EXISTS chk_recepcion_documento_tipo;

ALTER TABLE recepcion_documentos
ADD CONSTRAINT chk_recepcion_documento_tipo CHECK (
    tipo_documento IN ('factura', 'pedido', 'nota_credito', 'lista', 'imagen', 'documento')
);
