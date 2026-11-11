BEGIN;

ALTER TABLE ofertas
    ALTER COLUMN politica_contado SET DEFAULT 'precio_lista_promocional';

UPDATE ofertas
SET politica_contado = 'precio_lista_promocional',
    updated_at = NOW()
WHERE activa = TRUE
  AND fecha_hasta >= CURRENT_DATE
  AND politica_contado = 'precio_final_contado';

UPDATE reserva_items ri
SET oferta_politica_contado_snapshot = 'precio_lista_promocional'
FROM reservas r
WHERE r.id = ri.id_reserva
  AND r.estado = 'activa'
  AND ri.oferta_politica_contado_snapshot = 'precio_final_contado';

UPDATE reservas r
SET base_sin_descuento_contado = 0,
    updated_at = NOW()
WHERE r.estado = 'activa'
  AND r.base_sin_descuento_contado > 0
  AND EXISTS (
      SELECT 1
      FROM reserva_items ri
      WHERE ri.id_reserva = r.id
        AND ri.id_oferta IS NOT NULL
  );

UPDATE venta_items vi
SET oferta_politica_contado_snapshot = 'precio_lista_promocional'
FROM ventas v
WHERE v.id = vi.id_venta
  AND v.estado IN ('creada', 'pagada_parcial')
  AND vi.oferta_politica_contado_snapshot = 'precio_final_contado';

UPDATE ventas v
SET base_sin_descuento_contado = 0
WHERE v.estado IN ('creada', 'pagada_parcial')
  AND v.base_sin_descuento_contado > 0
  AND EXISTS (
      SELECT 1
      FROM venta_items vi
      WHERE vi.id_venta = v.id
        AND vi.id_oferta IS NOT NULL
  );

COMMIT;
