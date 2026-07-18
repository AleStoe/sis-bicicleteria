-- Permite distinguir costo faltante (NULL) de costo deliberadamente cero (0).
-- No recalcula precios, ventas ni stock.

ALTER TABLE variantes
    ALTER COLUMN costo_promedio_vigente DROP NOT NULL;

ALTER TABLE variantes
    DROP CONSTRAINT IF EXISTS chk_variantes_precios_no_negativos;

ALTER TABLE variantes
    ADD CONSTRAINT chk_variantes_precios_no_negativos
    CHECK (
        precio_minorista >= 0
        AND precio_mayorista >= 0
        AND (
            costo_promedio_vigente IS NULL
            OR costo_promedio_vigente >= 0
        )
    );
