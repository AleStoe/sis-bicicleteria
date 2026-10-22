BEGIN;

ALTER TABLE recepciones_mercaderia
ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_usuario_anulador INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

ALTER TABLE recepcion_sugerencias_regla
ADD COLUMN IF NOT EXISTS resuelta_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_usuario_resolutor INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS nota_resolucion TEXT;

CREATE INDEX IF NOT EXISTS idx_recepcion_sugerencias_estado
ON recepcion_sugerencias_regla (estado, ocurrencias DESC, id DESC);

COMMIT;
