BEGIN;

CREATE TABLE IF NOT EXISTS cliente_seguimientos (
    id BIGSERIAL PRIMARY KEY,
    id_cliente BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    tipo VARCHAR(30) NOT NULL,
    motivo VARCHAR(500) NOT NULL,
    fecha_objetivo DATE NOT NULL,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    id_usuario_responsable BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    id_usuario_creador BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    id_usuario_resolucion BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_resolucion TIMESTAMPTZ,
    resultado VARCHAR(1000),
    id_venta BIGINT REFERENCES ventas(id) ON DELETE RESTRICT,
    id_deuda BIGINT REFERENCES deudas_cliente(id) ON DELETE RESTRICT,
    id_reserva BIGINT REFERENCES reservas(id) ON DELETE RESTRICT,
    id_orden_taller BIGINT REFERENCES ordenes_taller(id) ON DELETE RESTRICT,
    id_bicicleta_cliente BIGINT REFERENCES bicicletas_clientes(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cliente_seguimientos_tipo CHECK (
        tipo IN ('llamada', 'whatsapp', 'service', 'presupuesto', 'reserva', 'deuda', 'postventa', 'otro')
    ),
    CONSTRAINT chk_cliente_seguimientos_prioridad CHECK (
        prioridad IN ('baja', 'normal', 'alta', 'urgente')
    ),
    CONSTRAINT chk_cliente_seguimientos_estado CHECK (
        estado IN ('pendiente', 'realizada', 'cancelada')
    ),
    CONSTRAINT chk_cliente_seguimientos_resolucion CHECK (
        (estado = 'pendiente' AND fecha_resolucion IS NULL AND id_usuario_resolucion IS NULL)
        OR
        (estado IN ('realizada', 'cancelada') AND fecha_resolucion IS NOT NULL AND id_usuario_resolucion IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_cliente_seguimientos_agenda
    ON cliente_seguimientos (estado, fecha_objetivo, prioridad, id);

CREATE INDEX IF NOT EXISTS idx_cliente_seguimientos_cliente
    ON cliente_seguimientos (id_cliente, estado, fecha_objetivo DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cliente_seguimientos_responsable
    ON cliente_seguimientos (id_usuario_responsable, estado, fecha_objetivo);

CREATE TABLE IF NOT EXISTS cliente_seguimiento_eventos (
    id BIGSERIAL PRIMARY KEY,
    id_seguimiento BIGINT NOT NULL REFERENCES cliente_seguimientos(id) ON DELETE RESTRICT,
    tipo_evento VARCHAR(30) NOT NULL,
    detalle VARCHAR(1000),
    fecha_objetivo_anterior DATE,
    fecha_objetivo_nueva DATE,
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20),
    id_usuario_responsable_anterior BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    id_usuario_responsable_nuevo BIGINT REFERENCES usuarios(id) ON DELETE RESTRICT,
    prioridad_anterior VARCHAR(20),
    prioridad_nueva VARCHAR(20),
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cliente_seguimiento_eventos_tipo CHECK (
        tipo_evento IN ('creado', 'reprogramado', 'realizado', 'cancelado')
    )
);

CREATE INDEX IF NOT EXISTS idx_cliente_seguimiento_eventos_orden
    ON cliente_seguimiento_eventos (id_seguimiento, created_at DESC, id DESC);

INSERT INTO permisos (codigo, descripcion)
VALUES ('gestionar_crm', 'Crear, reprogramar y cerrar seguimientos de clientes')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('administrador', 'encargado', 'operador')
  AND p.codigo = 'gestionar_crm'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
