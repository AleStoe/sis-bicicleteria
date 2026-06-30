BEGIN;

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('abrir_caja', 'Abrir la caja operativa'),
    ('registrar_pago', 'Registrar cobros y pagos'),
    ('registrar_egreso', 'Registrar egresos manuales de caja'),
    ('gestionar_gastos', 'Crear, corregir y anular gastos'),
    ('gestionar_capital_retiros', 'Administrar movimientos de capital y retiros')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'administrador'
  AND p.codigo IN (
      'abrir_caja',
      'registrar_pago',
      'registrar_egreso',
      'gestionar_gastos',
      'gestionar_capital_retiros'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'encargado'
  AND p.codigo IN (
      'abrir_caja',
      'registrar_pago',
      'registrar_egreso',
      'gestionar_gastos'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'operador'
  AND p.codigo IN (
      'abrir_caja',
      'registrar_pago'
  )
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
