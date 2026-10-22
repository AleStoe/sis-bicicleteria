BEGIN;

ALTER TABLE bicicleta_acondicionamientos
    DROP CONSTRAINT IF EXISTS chk_bicicleta_acondicionamientos_estado;

ALTER TABLE bicicleta_acondicionamientos
    ADD COLUMN IF NOT EXISTS fecha_aplicacion TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS id_usuario_aplicacion BIGINT REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS costo_componentes_real NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_adicional_real NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recuperos_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_acondicionamiento_aplicado NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_total_unidad_anterior NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS costo_total_unidad_nuevo NUMERIC(14,2),
    ADD CONSTRAINT chk_bicicleta_acondicionamientos_estado
        CHECK (estado IN ('borrador', 'confirmado', 'aplicado', 'revertido')),
    ADD CONSTRAINT chk_bicicleta_acondicionamientos_totales
        CHECK (
            costo_componentes_real >= 0
            AND costo_adicional_real >= 0
            AND recuperos_total >= 0
            AND costo_acondicionamiento_aplicado >= 0
        );

ALTER TABLE bicicleta_acondicionamiento_items
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS cantidad_consumida NUMERIC(14,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS costo_unitario_real NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS subtotal_real NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS id_movimiento_consumo BIGINT REFERENCES movimientos_stock(id),
    ADD COLUMN IF NOT EXISTS id_movimiento_reversion BIGINT REFERENCES movimientos_stock(id),
    ADD COLUMN IF NOT EXISTS fecha_consumo TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fecha_reversion TIMESTAMPTZ,
    ADD CONSTRAINT chk_bicicleta_acondicionamiento_item_estado
        CHECK (estado IN ('pendiente', 'consumido', 'revertido'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_bicicleta_acond_item_mov_consumo
    ON bicicleta_acondicionamiento_items (id_movimiento_consumo)
    WHERE id_movimiento_consumo IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bicicleta_acond_item_mov_reversion
    ON bicicleta_acondicionamiento_items (id_movimiento_reversion)
    WHERE id_movimiento_reversion IS NOT NULL;

ALTER TABLE bicicleta_acondicionamiento_costos
    ADD COLUMN IF NOT EXISTS costo_unitario_real NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS total_real NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS fecha_aplicacion TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS bicicleta_acondicionamiento_recuperos (
    id BIGSERIAL PRIMARY KEY,
    id_acondicionamiento BIGINT NOT NULL REFERENCES bicicleta_acondicionamientos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    descripcion VARCHAR(300) NOT NULL,
    monto NUMERIC(14,2) NOT NULL,
    referencia VARCHAR(150),
    observaciones VARCHAR(1000),
    id_usuario BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bicicleta_acondicionamiento_recupero_tipo
        CHECK (tipo IN ('nota_credito', 'garantia', 'recupero', 'otro')),
    CONSTRAINT chk_bicicleta_acondicionamiento_recupero_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_bicicleta_acondicionamiento_recuperos_orden
    ON bicicleta_acondicionamiento_recuperos (id_acondicionamiento, id);

ALTER TABLE movimientos_stock
    DROP CONSTRAINT IF EXISTS chk_movimientos_stock_origen_tipo;

ALTER TABLE movimientos_stock
    ADD CONSTRAINT chk_movimientos_stock_origen_tipo CHECK (
        origen_tipo IN (
            'ingreso_stock', 'venta', 'reserva', 'orden_taller', 'orden_armado',
            'ajuste_manual', 'devolucion_venta', 'transferencia',
            'bicicleta_serializada', 'inventario_fisico',
            'bicicleta_acondicionamiento'
        )
    );

ALTER TABLE movimientos_stock
    DROP CONSTRAINT IF EXISTS chk_movimientos_stock_tipo;

ALTER TABLE movimientos_stock
    ADD CONSTRAINT chk_movimientos_stock_tipo CHECK (
        tipo_movimiento IN (
            'ingreso', 'reserva', 'cancelacion_reserva', 'venta',
            'cancelacion_venta', 'entrega', 'devolucion_venta', 'devolucion',
            'ajuste', 'uso_taller', 'reversion_uso_taller', 'uso_armado',
            'reversion_uso_armado', 'uso_acondicionamiento',
            'reversion_uso_acondicionamiento', 'serializacion',
            'venta_serializada', 'entrega_serializada', 'anulacion_serializada',
            'devolucion_serializada'
        )
    );

COMMIT;
