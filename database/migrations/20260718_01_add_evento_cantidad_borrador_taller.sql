INSERT INTO tipos_evento_taller (codigo, descripcion, activo)
VALUES (
    'item_cantidad_borrador_actualizada',
    'Cantidad de item actualizada durante el armado del presupuesto',
    TRUE
)
ON CONFLICT (codigo) DO UPDATE
SET
    descripcion = EXCLUDED.descripcion,
    activo = TRUE;
