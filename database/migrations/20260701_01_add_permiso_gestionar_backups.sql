BEGIN;

INSERT INTO permisos (codigo, descripcion)
VALUES (
    'gestionar_backups',
    'Generar, listar y descargar backups del sistema'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'administrador'
  AND p.codigo = 'gestionar_backups'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
