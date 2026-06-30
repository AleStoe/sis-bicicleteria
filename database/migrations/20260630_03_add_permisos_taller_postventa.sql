BEGIN;

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('gestionar_taller', 'Crear y operar órdenes de taller'),
    ('gestionar_agenda_taller', 'Crear, editar y administrar turnos de taller'),
    ('gestionar_postventa', 'Crear y consumir services de postventa'),
    ('gestionar_garantias', 'Autorizar garantías y coberturas de postventa')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('administrador', 'encargado')
  AND p.codigo IN (
      'gestionar_taller',
      'gestionar_agenda_taller',
      'gestionar_postventa',
      'gestionar_garantias'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'mecanico'
  AND p.codigo = 'gestionar_taller'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
