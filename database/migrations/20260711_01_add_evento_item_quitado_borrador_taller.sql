INSERT INTO tipos_evento_taller (codigo, descripcion, activo)
VALUES (
    'item_quitado_borrador',
    'Item quitado durante el armado del presupuesto',
    TRUE
)
ON CONFLICT (codigo) DO UPDATE
SET
    descripcion = EXCLUDED.descripcion,
    activo = TRUE;
