INSERT INTO permisos (codigo, descripcion)
VALUES (
    'gestionar_correcciones',
    'Gestionar correcciones operativas auditadas'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'administrador'
  AND p.codigo = 'gestionar_correcciones'
ON CONFLICT DO NOTHING;

ALTER TABLE capital_movimientos_historial
DROP CONSTRAINT IF EXISTS chk_capital_historial_tipo;

ALTER TABLE capital_movimientos_historial
ADD CONSTRAINT chk_capital_historial_tipo
CHECK (
    tipo_evento IN (
        'creacion',
        'anulacion',
        'correccion_caja'
    )
);
