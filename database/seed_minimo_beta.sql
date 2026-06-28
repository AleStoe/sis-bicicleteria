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
    ('cancelar_reserva', 'Cancelar reservas'),
    ('cerrar_caja', 'Cerrar caja'),
    ('configuracion_comercial', 'Administrar configuración comercial'),
    ('entregar_con_deuda', 'Entregar ventas generando deuda formal'),
    ('generar_deuda', 'Generar deuda formal'),
    ('gestionar_usuarios', 'Administrar usuarios y roles'),
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
      'cancelar_reserva',
      'cerrar_caja',
      'entregar_con_deuda',
      'generar_deuda',
      'reintegrar_credito',
      'revertir_pago'
  )
WHERE r.nombre = 'encargado'
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
