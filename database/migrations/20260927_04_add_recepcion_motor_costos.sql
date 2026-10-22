CREATE TABLE IF NOT EXISTS recepcion_mercaderia_costos (
    id SERIAL PRIMARY KEY,
    id_recepcion INTEGER NOT NULL UNIQUE
        REFERENCES recepciones_mercaderia(id) ON DELETE CASCADE,
    descuento_global_pct NUMERIC(7,4) NOT NULL DEFAULT 0,
    nota_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
    flete NUMERIC(14,2) NOT NULL DEFAULT 0,
    otros_gastos NUMERIC(14,2) NOT NULL DEFAULT 0,
    impuestos_no_recuperables NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_documental NUMERIC(14,2),
    subtotal_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
    descuento_lineas_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    descuento_global_monto NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_calculado NUMERIC(14,2) NOT NULL DEFAULT 0,
    diferencia_conciliacion NUMERIC(14,2),
    conciliado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_recepcion_costo_descuento_pct
        CHECK (descuento_global_pct >= 0 AND descuento_global_pct <= 100),
    CONSTRAINT chk_recepcion_costo_importes
        CHECK (
            nota_credito >= 0 AND flete >= 0 AND otros_gastos >= 0
            AND impuestos_no_recuperables >= 0
            AND (total_documental IS NULL OR total_documental >= 0)
        )
);

ALTER TABLE recepcion_mercaderia_items
ADD COLUMN IF NOT EXISTS descuento_linea_pct NUMERIC(7,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS importe_bruto NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS descuento_linea_monto NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS base_prorrateo NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS prorrateo_descuento_global NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS prorrateo_nota_credito NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS prorrateo_gastos NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS costo_total_calculado NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS costo_unitario_calculado NUMERIC(14,2);

ALTER TABLE recepcion_mercaderia_items
DROP CONSTRAINT IF EXISTS chk_recepcion_item_descuento_pct;

ALTER TABLE recepcion_mercaderia_items
ADD CONSTRAINT chk_recepcion_item_descuento_pct
CHECK (descuento_linea_pct >= 0 AND descuento_linea_pct <= 100);
