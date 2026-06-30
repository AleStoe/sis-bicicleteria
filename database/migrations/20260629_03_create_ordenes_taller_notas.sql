CREATE TABLE IF NOT EXISTS ordenes_taller_notas (
    id BIGSERIAL PRIMARY KEY,
    id_orden_taller BIGINT NOT NULL,
    id_bicicleta_cliente BIGINT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    contenido TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    id_usuario_creador BIGINT NOT NULL,
    id_usuario_actualiza BIGINT,
    fecha_resolucion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_ordenes_taller_notas_orden
        FOREIGN KEY (id_orden_taller) REFERENCES ordenes_taller(id),
    CONSTRAINT fk_ordenes_taller_notas_bicicleta
        FOREIGN KEY (id_bicicleta_cliente) REFERENCES bicicletas_clientes(id),
    CONSTRAINT fk_ordenes_taller_notas_usuario_creador
        FOREIGN KEY (id_usuario_creador) REFERENCES usuarios(id),
    CONSTRAINT fk_ordenes_taller_notas_usuario_actualiza
        FOREIGN KEY (id_usuario_actualiza) REFERENCES usuarios(id),
    CONSTRAINT chk_ordenes_taller_notas_tipo
        CHECK (
            tipo IN (
                'interna',
                'cliente',
                'recomendacion_futura',
                'alerta_tecnica'
            )
        ),
    CONSTRAINT chk_ordenes_taller_notas_estado
        CHECK (estado IN ('activa', 'resuelta', 'archivada')),
    CONSTRAINT chk_ordenes_taller_notas_contenido
        CHECK (LENGTH(TRIM(contenido)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ordenes_taller_notas_orden
    ON ordenes_taller_notas (id_orden_taller, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ordenes_taller_notas_bicicleta
    ON ordenes_taller_notas (id_bicicleta_cliente, tipo, estado);

INSERT INTO tipos_evento_taller (codigo, descripcion, activo)
VALUES
    ('nota_tecnica_creada', 'Nota técnica agregada a la orden', TRUE),
    ('nota_tecnica_actualizada', 'Nota técnica editada o cambió de estado', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET
    descripcion = EXCLUDED.descripcion,
    activo = TRUE;
