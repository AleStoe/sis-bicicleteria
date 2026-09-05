CREATE TABLE IF NOT EXISTS catalogo_rubros (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    label VARCHAR(80) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_catalogo_rubros_nombre_upper
ON catalogo_rubros (UPPER(nombre));

INSERT INTO catalogo_rubros (nombre, label, descripcion, orden, activo)
SELECT seed.nombre, seed.label, seed.descripcion, seed.orden, seed.activo
FROM (
    VALUES
        ('BICICLETAS', 'Bicicletas', 'Bicicletas completas y variantes serializables.', 10, TRUE),
        ('TRICICLOS', 'Triciclos', 'Triciclos y rodados infantiles no necesariamente serializados.', 20, TRUE),
        ('CUATRICICLOS', 'Cuatriciclos', 'Cuatriciclos infantiles o recreativos vendidos como unidad.', 30, TRUE),
        ('REPUESTOS', 'Repuestos', 'Piezas, cubiertas, camaras y componentes stockeables.', 40, TRUE),
        ('ACCESORIOS', 'Accesorios', 'Accesorios de venta directa para bici o local.', 50, TRUE),
        ('INDUMENTARIA', 'Indumentaria', 'Ropa, protecciones y articulos personales.', 60, TRUE),
        ('HERRAMIENTAS', 'Herramientas', 'Herramientas, extractores, llaves y kits de trabajo.', 70, TRUE),
        ('CUBIERTAS AUTO', 'Cubiertas auto', 'Cubiertas de auto separadas del catalogo de bicicletas.', 80, TRUE),
        ('SERVICIOS', 'Servicios', 'Mano de obra y servicios de taller.', 90, TRUE)
) AS seed(nombre, label, descripcion, orden, activo)
WHERE NOT EXISTS (
    SELECT 1
    FROM catalogo_rubros r
    WHERE UPPER(r.nombre) = UPPER(seed.nombre)
);
