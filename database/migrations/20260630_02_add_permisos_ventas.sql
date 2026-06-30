BEGIN;

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('crear_venta', 'Crear y entregar ventas'),
    ('modificar_precio_venta', 'Aplicar precios manuales o bonificaciones en ventas'),
    ('aplicar_credito_venta', 'Aplicar crédito comercial a una venta'),
    ('gestionar_devoluciones', 'Registrar devoluciones de ventas')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'administrador'
  AND p.codigo IN (
      'crear_venta',
      'modificar_precio_venta',
      'aplicar_credito_venta',
      'gestionar_devoluciones'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'encargado'
  AND p.codigo IN (
      'crear_venta',
      'modificar_precio_venta',
      'aplicar_credito_venta',
      'gestionar_devoluciones'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'operador'
  AND p.codigo IN (
      'crear_venta',
      'aplicar_credito_venta'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
