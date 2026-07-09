-- Permite que varias bicicletas serializadas compartan numero_cuadro.
-- La identidad operativa de la unidad es bicicletas_serializadas.id.

ALTER TABLE bicicletas_serializadas
    DROP CONSTRAINT IF EXISTS uq_bicicletas_serializadas_numero_cuadro;
