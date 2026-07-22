CREATE TABLE IF NOT EXISTS postventa_caso_ordenes (
    id BIGSERIAL PRIMARY KEY,
    id_caso_postventa BIGINT NOT NULL REFERENCES postventa_casos(id) ON DELETE CASCADE,
    id_orden_taller BIGINT NOT NULL REFERENCES ordenes_taller(id),
    fecha_vinculacion TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT ux_postventa_caso_ordenes_orden UNIQUE (id_orden_taller)
);

CREATE INDEX IF NOT EXISTS idx_postventa_caso_ordenes_caso
    ON postventa_caso_ordenes (id_caso_postventa, fecha_vinculacion);

