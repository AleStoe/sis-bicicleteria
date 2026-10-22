BEGIN;

ALTER TABLE venta_items
    ADD COLUMN IF NOT EXISTS origen_costo_snapshot text,
    ADD COLUMN IF NOT EXISTS id_orden_armado_origen_snapshot bigint;

UPDATE venta_items vi
SET origen_costo_snapshot = CASE
        WHEN bs.id IS NOT NULL
             AND COALESCE(bs.costo_acondicionamiento, 0) > 0
             AND vi.costo_unitario_aplicado = bs.costo_total_unitario
            THEN 'costo_unidad_serializada'
        WHEN bs.id_orden_armado_origen IS NOT NULL
            THEN 'fabricacion_propia'
        ELSE 'costo_promedio_variante'
    END,
    id_orden_armado_origen_snapshot = bs.id_orden_armado_origen
FROM bicicletas_serializadas bs
WHERE vi.id_bicicleta_serializada = bs.id
  AND vi.origen_costo_snapshot IS NULL;

UPDATE venta_items
SET origen_costo_snapshot = 'costo_promedio_variante'
WHERE origen_costo_snapshot IS NULL
  AND tipo_item = 'producto';

COMMIT;
