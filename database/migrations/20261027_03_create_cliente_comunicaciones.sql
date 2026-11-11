CREATE TABLE IF NOT EXISTS cliente_preferencias_contacto (
    id_cliente bigint PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
    estado varchar(20) NOT NULL DEFAULT 'habilitado',
    canal_preferido varchar(20),
    motivo_exclusion text,
    id_usuario_actualizacion bigint REFERENCES usuarios(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cliente_preferencia_estado_check CHECK (estado IN ('habilitado', 'no_contactar')),
    CONSTRAINT cliente_preferencia_canal_check CHECK (canal_preferido IS NULL OR canal_preferido IN ('whatsapp', 'llamada', 'otro'))
);

CREATE TABLE IF NOT EXISTS cliente_comunicaciones (
    id bigserial PRIMARY KEY,
    id_cliente bigint NOT NULL REFERENCES clientes(id),
    id_seguimiento bigint REFERENCES cliente_seguimientos(id),
    canal varchar(20) NOT NULL,
    resultado varchar(30) NOT NULL,
    mensaje text,
    nota text,
    fecha_contacto timestamptz NOT NULL DEFAULT now(),
    id_usuario bigint NOT NULL REFERENCES usuarios(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cliente_comunicacion_canal_check CHECK (canal IN ('whatsapp', 'llamada', 'otro')),
    CONSTRAINT cliente_comunicacion_resultado_check CHECK (
        resultado IN ('contactado', 'sin_respuesta', 'respondio', 'interesado', 'no_interesado', 'convertido', 'otro')
    )
);

CREATE INDEX IF NOT EXISTS idx_cliente_comunicaciones_cliente_fecha
    ON cliente_comunicaciones (id_cliente, fecha_contacto DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_comunicaciones_resultado_fecha
    ON cliente_comunicaciones (resultado, fecha_contacto DESC);
