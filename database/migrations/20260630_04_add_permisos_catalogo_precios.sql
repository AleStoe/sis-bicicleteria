BEGIN;

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('gestionar_catalogo', 'Administrar catálogo y maestros comerciales'),
    ('gestionar_precios', 'Consultar costos y administrar precios')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'administrador'
  AND p.codigo IN (
      'configuracion_comercial',
      'gestionar_catalogo',
      'gestionar_precios',
      'ver_auditoria',
      'ver_rentabilidad',
      'gestionar_capital_retiros'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'encargado'
  AND p.codigo IN ('gestionar_catalogo', 'gestionar_precios')
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
