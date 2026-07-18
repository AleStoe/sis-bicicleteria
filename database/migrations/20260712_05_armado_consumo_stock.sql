ALTER TABLE armado_ordenes
DROP CONSTRAINT IF EXISTS chk_armado_orden_estado;

ALTER TABLE armado_ordenes
ADD CONSTRAINT chk_armado_orden_estado CHECK (
    estado IN (
        'borrador',
        'pendiente_componentes',
        'lista_para_armar',
        'en_armado',
        'cancelada'
    )
);

ALTER TABLE armado_ordenes
ADD COLUMN IF NOT EXISTS fecha_inicio timestamptz,
ADD COLUMN IF NOT EXISTS id_usuario_inicio bigint REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS costo_componentes_real numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_total_real numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS desvio_componentes numeric(14,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
ADD COLUMN IF NOT EXISTS id_usuario_cancelacion bigint REFERENCES usuarios(id);

ALTER TABLE armado_orden_items
DROP CONSTRAINT IF EXISTS chk_armado_orden_items_estado;

ALTER TABLE armado_orden_items
DROP CONSTRAINT IF EXISTS chk_armado_orden_items_costos;

ALTER TABLE armado_orden_items
ADD COLUMN IF NOT EXISTS cantidad_consumida numeric(14,3) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_unitario_real numeric(14,4),
ADD COLUMN IF NOT EXISTS subtotal_real numeric(14,4),
ADD COLUMN IF NOT EXISTS id_movimiento_consumo bigint REFERENCES movimientos_stock(id),
ADD COLUMN IF NOT EXISTS id_movimiento_reversion bigint REFERENCES movimientos_stock(id),
ADD COLUMN IF NOT EXISTS fecha_consumo timestamptz,
ADD COLUMN IF NOT EXISTS fecha_reversion timestamptz;

ALTER TABLE armado_orden_items
ADD CONSTRAINT chk_armado_orden_items_estado CHECK (
    estado IN (
        'pendiente',
        'disponible',
        'faltante',
        'sustituido',
        'omitido',
        'consumido',
        'revertido'
    )
);

ALTER TABLE armado_orden_items
ADD CONSTRAINT chk_armado_orden_items_costos CHECK (
    ((costo_unitario_previsto IS NULL) OR (costo_unitario_previsto >= 0))
    AND ((subtotal_previsto IS NULL) OR (subtotal_previsto >= 0))
    AND ((costo_unitario_real IS NULL) OR (costo_unitario_real >= 0))
    AND ((subtotal_real IS NULL) OR (subtotal_real >= 0))
    AND cantidad_consumida >= 0
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_armado_orden_items_mov_consumo
ON armado_orden_items(id_movimiento_consumo)
WHERE id_movimiento_consumo IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_armado_orden_items_mov_reversion
ON armado_orden_items(id_movimiento_reversion)
WHERE id_movimiento_reversion IS NOT NULL;

ALTER TABLE movimientos_stock
DROP CONSTRAINT IF EXISTS chk_movimientos_stock_origen_tipo;

ALTER TABLE movimientos_stock
ADD CONSTRAINT chk_movimientos_stock_origen_tipo CHECK (
    origen_tipo IN (
        'ingreso_stock',
        'venta',
        'reserva',
        'orden_taller',
        'orden_armado',
        'ajuste_manual',
        'devolucion_venta',
        'transferencia',
        'bicicleta_serializada',
        'inventario_fisico'
    )
);

ALTER TABLE movimientos_stock
DROP CONSTRAINT IF EXISTS chk_movimientos_stock_tipo;

ALTER TABLE movimientos_stock
ADD CONSTRAINT chk_movimientos_stock_tipo CHECK (
    tipo_movimiento IN (
        'ingreso',
        'reserva',
        'cancelacion_reserva',
        'venta',
        'cancelacion_venta',
        'entrega',
        'devolucion_venta',
        'devolucion',
        'ajuste',
        'uso_taller',
        'reversion_uso_taller',
        'uso_armado',
        'reversion_uso_armado',
        'serializacion',
        'venta_serializada',
        'entrega_serializada',
        'anulacion_serializada',
        'devolucion_serializada'
    )
);
