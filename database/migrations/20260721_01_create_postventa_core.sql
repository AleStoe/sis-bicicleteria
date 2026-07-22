CREATE SEQUENCE IF NOT EXISTS postventa_caso_codigo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS postventa_casos (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE DEFAULT ('PV-' || LPAD(nextval('postventa_caso_codigo_seq')::text, 6, '0')),
    estado VARCHAR(30) NOT NULL DEFAULT 'abierto',
    tipo_caso VARCHAR(40) NOT NULL,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
    id_cliente BIGINT NOT NULL REFERENCES clientes(id),
    id_venta_origen BIGINT REFERENCES ventas(id),
    id_venta_item_origen BIGINT REFERENCES venta_items(id),
    id_bicicleta_cliente BIGINT REFERENCES bicicletas_clientes(id),
    id_bicicleta_serializada BIGINT REFERENCES bicicletas_serializadas(id),
    id_variante BIGINT REFERENCES variantes(id),
    id_proveedor BIGINT REFERENCES proveedores(id),
    motivo_cliente TEXT NOT NULL,
    evaluacion_tecnica TEXT,
    causa_determinada TEXT,
    decision_proveedor VARCHAR(40),
    detalle_decision_proveedor TEXT,
    monto_reconocido_proveedor NUMERIC(14,2) DEFAULT 0 NOT NULL,
    decision_local VARCHAR(40),
    detalle_decision_local TEXT,
    cobertura_tipo VARCHAR(40),
    responsable_economico VARCHAR(40),
    monto_cubierto_proveedor NUMERIC(14,2) DEFAULT 0 NOT NULL,
    monto_cubierto_local NUMERIC(14,2) DEFAULT 0 NOT NULL,
    monto_a_cargo_cliente NUMERIC(14,2) DEFAULT 0 NOT NULL,
    resolucion_aplicada TEXT,
    resultado_final TEXT,
    observaciones TEXT,
    fecha_apertura TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    fecha_cierre TIMESTAMPTZ,
    id_usuario_creador BIGINT NOT NULL REFERENCES usuarios(id),
    id_usuario_cierre BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_postventa_casos_estado CHECK (
        estado IN (
            'abierto',
            'en_evaluacion',
            'esperando_proveedor',
            'decision_pendiente',
            'aprobado_total',
            'aprobado_parcial',
            'rechazado',
            'en_resolucion',
            'esperando_retiro',
            'resuelto',
            'cerrado',
            'cancelado',
            'reabierto'
        )
    ),
    CONSTRAINT chk_postventa_casos_tipo CHECK (
        tipo_caso IN (
            'service_postventa',
            'garantia_fabrica',
            'garantia_local',
            'reclamo_tecnico',
            'atencion_comercial',
            'devolucion_cambio',
            'revision'
        )
    ),
    CONSTRAINT chk_postventa_casos_prioridad CHECK (
        prioridad IN ('baja', 'normal', 'alta', 'urgente')
    ),
    CONSTRAINT chk_postventa_montos_no_negativos CHECK (
        monto_reconocido_proveedor >= 0
        AND monto_cubierto_proveedor >= 0
        AND monto_cubierto_local >= 0
        AND monto_a_cargo_cliente >= 0
    )
);

CREATE TABLE IF NOT EXISTS postventa_eventos (
    id BIGSERIAL PRIMARY KEY,
    id_caso_postventa BIGINT NOT NULL REFERENCES postventa_casos(id) ON DELETE CASCADE,
    fecha TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    tipo_evento VARCHAR(50) NOT NULL,
    detalle TEXT,
    metadata JSONB,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_postventa_casos_cliente ON postventa_casos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_postventa_casos_estado ON postventa_casos(estado);
CREATE INDEX IF NOT EXISTS idx_postventa_casos_tipo ON postventa_casos(tipo_caso);
CREATE INDEX IF NOT EXISTS idx_postventa_casos_fecha ON postventa_casos(fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_postventa_casos_venta ON postventa_casos(id_venta_origen);
CREATE INDEX IF NOT EXISTS idx_postventa_casos_bicicleta_cliente ON postventa_casos(id_bicicleta_cliente);
CREATE INDEX IF NOT EXISTS idx_postventa_casos_bicicleta_serializada ON postventa_casos(id_bicicleta_serializada);
CREATE INDEX IF NOT EXISTS idx_postventa_eventos_caso ON postventa_eventos(id_caso_postventa, fecha);
