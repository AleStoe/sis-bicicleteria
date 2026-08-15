UPDATE productos p
SET rubro = 'HERRAMIENTAS'
WHERE (
    EXISTS (
        SELECT 1
        FROM categorias c
        WHERE c.id = p.id_categoria
          AND (
            UPPER(c.nombre) LIKE '%HERRAMIENTA%'
            OR UPPER(c.nombre) LIKE '%HERRAMIENTAS%'
          )
    )
    OR UPPER(p.nombre) LIKE '%HERRAMIENTA%'
    OR UPPER(p.nombre) LIKE '%HERRAMIENTAS%'
    OR UPPER(p.nombre) LIKE '%EXTRACTOR%'
    OR UPPER(p.nombre) LIKE '%LLAVE%'
)
AND COALESCE(p.rubro, '') <> 'HERRAMIENTAS';
