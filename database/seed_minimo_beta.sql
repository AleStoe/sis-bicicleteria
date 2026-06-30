BEGIN;

INSERT INTO public.roles (nombre, descripcion)
VALUES
    ('administrador', 'Acceso administrativo completo'),
    ('encargado', 'Operación diaria con acciones sensibles'),
    ('operador', 'Operación de mostrador'),
    ('mecanico', 'Operación de taller')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.permisos (codigo, descripcion)
VALUES
    ('ajustar_caja', 'Realizar ajustes de caja'),
    ('ajustar_stock', 'Realizar ajustes de stock e inventario'),
    ('anular_venta', 'Anular ventas'),
    ('aplicar_credito_venta', 'Aplicar crédito comercial a una venta'),
    ('abrir_caja', 'Abrir la caja operativa'),
    ('cancelar_reserva', 'Cancelar reservas'),
    ('cerrar_caja', 'Cerrar caja'),
    ('configuracion_comercial', 'Administrar configuración comercial'),
    ('crear_venta', 'Crear y entregar ventas'),
    ('entregar_con_deuda', 'Entregar ventas generando deuda formal'),
    ('generar_deuda', 'Generar deuda formal'),
    ('gestionar_capital_retiros', 'Administrar movimientos de capital y retiros'),
    ('gestionar_devoluciones', 'Registrar devoluciones de ventas'),
    ('gestionar_gastos', 'Crear, corregir y anular gastos'),
    ('gestionar_usuarios', 'Administrar usuarios y roles'),
    ('modificar_precio_venta', 'Aplicar precios manuales o bonificaciones en ventas'),
    ('registrar_egreso', 'Registrar egresos manuales de caja'),
    ('registrar_pago', 'Registrar cobros y pagos'),
    ('reintegrar_credito', 'Reintegrar créditos comerciales'),
    ('revertir_pago', 'Revertir pagos confirmados'),
    ('ver_auditoria', 'Consultar auditoría'),
    ('ver_capital_retiros', 'Consultar capital y retiros'),
    ('ver_rentabilidad', 'Consultar rentabilidad')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permisos p
WHERE r.nombre = 'administrador'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p
  ON p.codigo IN (
      'ajustar_caja',
      'ajustar_stock',
      'anular_venta',
      'aplicar_credito_venta',
      'abrir_caja',
      'cancelar_reserva',
      'cerrar_caja',
      'crear_venta',
      'entregar_con_deuda',
      'generar_deuda',
      'gestionar_gastos',
      'gestionar_devoluciones',
      'modificar_precio_venta',
      'registrar_egreso',
      'registrar_pago',
      'reintegrar_credito',
      'revertir_pago'
  )
WHERE r.nombre = 'encargado'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permisos p
  ON p.codigo IN (
      'abrir_caja',
      'aplicar_credito_venta',
      'crear_venta',
      'registrar_pago'
  )
WHERE r.nombre = 'operador'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

INSERT INTO public.sucursales (nombre, direccion, activa)
SELECT 'LOCAL PRINCIPAL', NULL, TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM public.sucursales
    WHERE UPPER(BTRIM(nombre)) = 'LOCAL PRINCIPAL'
);

INSERT INTO public.configuracion_negocio (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clientes (
    nombre,
    tipo_cliente,
    condicion_iva,
    activo,
    notas
)
SELECT
    'CONSUMIDOR FINAL',
    'consumidor_final',
    'consumidor_final',
    TRUE,
    'Cliente técnico para ventas rápidas'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.clientes
    WHERE tipo_cliente = 'consumidor_final'
);

COMMIT;
