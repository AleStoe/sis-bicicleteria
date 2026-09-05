INSERT INTO categorias (nombre, activo)
SELECT 'TRICICLOS', TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE UPPER(nombre) = 'TRICICLOS'
);

INSERT INTO categorias (nombre, activo)
SELECT 'CUATRICICLOS', TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM categorias
    WHERE UPPER(nombre) = 'CUATRICICLOS'
);
