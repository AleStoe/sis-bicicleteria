UPDATE productos p
SET subtipo_catalogo = CASE
    WHEN UPPER(p.nombre) LIKE '%SILLITA%'
      OR UPPER(p.nombre) LIKE '%PORTASILLA%'
      OR UPPER(p.nombre) LIKE '%PORTASILLAS%'
        THEN 'SILLITA / PORTASILLA'

    WHEN (
        UPPER(p.nombre) LIKE '%ABRAZADERA%'
        OR UPPER(p.nombre) LIKE '%COLLAR%'
      )
      AND (
        UPPER(p.nombre) LIKE '%ASIENTO%'
        OR UPPER(p.nombre) LIKE '%SILLIN%'
        OR UPPER(p.nombre) LIKE '%SILLÍN%'
      )
        THEN 'ABRAZADERA DE ASIENTO'

    WHEN UPPER(p.nombre) LIKE '%CAÑO ASIENTO%'
      OR UPPER(p.nombre) LIKE '%CAÑO DE ASIENTO%'
      OR UPPER(p.nombre) LIKE '%CANO ASIENTO%'
      OR UPPER(p.nombre) LIKE '%CANO DE ASIENTO%'
      OR UPPER(p.nombre) LIKE '%POSTE ASIENTO%'
      OR UPPER(p.nombre) LIKE '%POSTE DE ASIENTO%'
      OR UPPER(p.nombre) LIKE '%VELA ASIENTO%'
      OR UPPER(p.nombre) LIKE '%VELA DE ASIENTO%'
        THEN 'CAÑO DE ASIENTO'

    WHEN UPPER(p.nombre) LIKE '%ASIENTO%'
      OR UPPER(p.nombre) LIKE '%SILLIN%'
      OR UPPER(p.nombre) LIKE '%SILLÍN%'
        THEN 'ASIENTO'

    WHEN UPPER(p.nombre) LIKE '%ACOPLE%'
      OR UPPER(p.nombre) LIKE '%CUERNITO%'
      OR UPPER(p.nombre) LIKE '%CUERNITOS%'
        THEN 'ACOPLE / CUERNITO'

    WHEN UPPER(p.nombre) LIKE '%SEPARADOR%'
      OR UPPER(p.nombre) LIKE '%ESPACIADOR%'
        THEN 'SEPARADOR / ESPACIADOR'

    WHEN UPPER(p.nombre) LIKE '%ADAPTADOR%'
        THEN 'ADAPTADOR'

    WHEN UPPER(p.nombre) LIKE '%STEM%'
        THEN 'STEM'

    WHEN UPPER(p.nombre) LIKE '%MANUBRIO%'
        THEN 'MANUBRIO'

    WHEN UPPER(p.nombre) LIKE '%CINTA%'
      OR UPPER(p.nombre) LIKE '%CINTAS%'
        THEN 'CINTA DE MANUBRIO'

    WHEN UPPER(p.nombre) LIKE '%PUÑO%'
      OR UPPER(p.nombre) LIKE '%PUÑOS%'
      OR UPPER(p.nombre) LIKE '%PUNO%'
      OR UPPER(p.nombre) LIKE '%PUNOS%'
        THEN 'PUÑO'

    WHEN UPPER(p.nombre) LIKE '%GRIP%'
        THEN 'GRIP'

    ELSE p.subtipo_catalogo
END
WHERE UPPER(p.nombre) LIKE '%SILLITA%'
   OR UPPER(p.nombre) LIKE '%PORTASILLA%'
   OR UPPER(p.nombre) LIKE '%PORTASILLAS%'
   OR UPPER(p.nombre) LIKE '%ASIENTO%'
   OR UPPER(p.nombre) LIKE '%SILLIN%'
   OR UPPER(p.nombre) LIKE '%SILLÍN%'
   OR UPPER(p.nombre) LIKE '%ACOPLE%'
   OR UPPER(p.nombre) LIKE '%CUERNITO%'
   OR UPPER(p.nombre) LIKE '%CUERNITOS%'
   OR UPPER(p.nombre) LIKE '%SEPARADOR%'
   OR UPPER(p.nombre) LIKE '%ESPACIADOR%'
   OR UPPER(p.nombre) LIKE '%ADAPTADOR%'
   OR UPPER(p.nombre) LIKE '%STEM%'
   OR UPPER(p.nombre) LIKE '%MANUBRIO%'
   OR UPPER(p.nombre) LIKE '%CINTA%'
   OR UPPER(p.nombre) LIKE '%CINTAS%'
   OR UPPER(p.nombre) LIKE '%PUÑO%'
   OR UPPER(p.nombre) LIKE '%PUÑOS%'
   OR UPPER(p.nombre) LIKE '%PUNO%'
   OR UPPER(p.nombre) LIKE '%PUNOS%'
   OR UPPER(p.nombre) LIKE '%GRIP%'
   OR p.subtipo_catalogo IN ('MANUBRIO / STEM', 'PUÑO / CINTA');
