ALTER TABLE productos
ADD COLUMN IF NOT EXISTS subtipo_catalogo VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_productos_subtipo_catalogo
ON productos (subtipo_catalogo);

UPDATE productos p
SET subtipo_catalogo = CASE
    WHEN p.serializable = TRUE
      OR UPPER(p.nombre) LIKE 'BICICLETA %'
        THEN 'BICICLETA'

    WHEN p.rubro = 'CUBIERTAS AUTO'
        THEN 'CUBIERTA AUTO'

    WHEN UPPER(p.nombre) LIKE '%CUBRE RAYOS%'
        THEN 'CUBRE RAYOS'

    WHEN UPPER(p.nombre) LIKE '%EXTRACTOR%'
      OR UPPER(p.nombre) LIKE '%LLAVE%'
      OR UPPER(p.nombre) LIKE '%HERRAMIENTA%'
        THEN 'HERRAMIENTA'

    WHEN UPPER(p.nombre) LIKE '%BOLSO%'
      OR UPPER(p.nombre) LIKE '%BOLSITO%'
        THEN 'BOLSO'

    WHEN UPPER(p.nombre) LIKE '%CASCO%'
        THEN 'CASCO'

    WHEN UPPER(p.nombre) LIKE '%GUANTE%'
        THEN 'GUANTES'

    WHEN UPPER(p.nombre) LIKE '%CUELLITO%'
      OR UPPER(p.nombre) LIKE '%CUELLO%'
        THEN 'CUELLITO'

    WHEN UPPER(p.nombre) LIKE '%JERSEY%'
        THEN 'JERSEY'

    WHEN UPPER(p.nombre) LIKE '%CAMPERA%'
        THEN 'CAMPERA'

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

    WHEN UPPER(p.nombre) LIKE '%CANASTO%'
      OR UPPER(p.nombre) LIKE '%CANASTA%'
        THEN 'CANASTO'

    WHEN UPPER(p.nombre) LIKE '%CARAMAÑOLA%'
      OR UPPER(p.nombre) LIKE '%CARAMANOLA%'
      OR UPPER(p.nombre) LIKE '%PORTACARAMAÑOLA%'
      OR UPPER(p.nombre) LIKE '%PORTACARAMANOLA%'
        THEN 'CARAMAÑOLA / PORTA'

    WHEN UPPER(p.nombre) LIKE '%ESLINGA%'
      OR UPPER(p.nombre) LIKE '%LINGA%'
        THEN 'ESLINGA'

    WHEN UPPER(p.nombre) LIKE '%INFLADOR%'
        THEN 'INFLADOR'

    WHEN UPPER(p.nombre) LIKE '%LUZ%'
      OR UPPER(p.nombre) LIKE '%LUCES%'
      OR UPPER(p.nombre) LIKE '%FOCO%'
        THEN 'LUZ'

    WHEN UPPER(p.nombre) LIKE '%TIMBRE%'
      OR UPPER(p.nombre) LIKE '%BOCINA%'
        THEN 'TIMBRE / BOCINA'

    WHEN UPPER(p.nombre) LIKE '%COMPUTADORA%'
      OR UPPER(p.nombre) LIKE '%CICLOCOMPUTADORA%'
        THEN 'COMPUTADORA'

    WHEN UPPER(p.nombre) LIKE '%BOLILLA%'
      OR UPPER(p.nombre) LIKE '%BOLILLERO%'
        THEN 'BOLILLERO / BOLILLAS'

    WHEN UPPER(p.nombre) LIKE '%RULEMAN%'
      OR UPPER(p.nombre) LIKE '%RULEMÁN%'
      OR UPPER(p.nombre) LIKE '%RODAMIENTO%'
        THEN 'RULEMAN / RODAMIENTO'

    WHEN UPPER(p.nombre) LIKE '%CUBETA%'
        THEN 'CUBETA'

    WHEN UPPER(p.nombre) LIKE '%CIERRE%'
      OR UPPER(p.nombre) LIKE '%SAQUE%'
        THEN 'CIERRE RÁPIDO'

    WHEN UPPER(p.nombre) LIKE '%EJE%'
      AND UPPER(p.nombre) LIKE '%MAZA%'
        THEN 'EJE DE MAZA'

    WHEN UPPER(p.nombre) LIKE '%MAZA%'
      AND (
          UPPER(p.nombre) LIKE '%DELANTERA%'
          OR UPPER(p.nombre) LIKE '%DELANTERO%'
      )
        THEN 'MAZA DELANTERA'

    WHEN UPPER(p.nombre) LIKE '%MAZA%'
      AND (
          UPPER(p.nombre) LIKE '%TRASERA%'
          OR UPPER(p.nombre) LIKE '%TRASERO%'
      )
        THEN 'MAZA TRASERA'

    WHEN UPPER(p.nombre) LIKE '%MAZA%'
      OR UPPER(p.nombre) LIKE '%MAZAS%'
        THEN 'MAZA'

    WHEN UPPER(p.nombre) LIKE '%CADENA%'
        THEN 'CADENA'

    WHEN UPPER(p.nombre) LIKE '%PIÑON%'
      OR UPPER(p.nombre) LIKE '%PIÑÓN%'
      OR UPPER(p.nombre) LIKE '%PINON%'
        THEN 'PIÑÓN'

    WHEN UPPER(p.nombre) LIKE '%DESCARRILADOR%'
      OR UPPER(p.nombre) LIKE '%CAMBIO TRASERO%'
      OR UPPER(p.nombre) LIKE '%PATA%'
        THEN 'PATA DE CAMBIO / DESCARRILADOR'

    WHEN UPPER(p.nombre) LIKE '%FUSIBLE%'
        THEN 'FUSIBLE'

    WHEN UPPER(p.nombre) LIKE '%SHIFTER%'
      OR UPPER(p.nombre) LIKE '%MANIJA CAMBIO%'
        THEN 'SHIFTER / MANIJA CAMBIO'

    WHEN UPPER(p.nombre) LIKE '%CABLE%'
      OR UPPER(p.nombre) LIKE '%FORRO%'
        THEN 'CABLE / FORRO'

    WHEN UPPER(p.nombre) LIKE '%FRENO%'
      OR UPPER(p.nombre) LIKE '%FRENOS%'
      OR UPPER(p.nombre) LIKE '%PASTILLA%'
      OR UPPER(p.nombre) LIKE '%DISCO%'
        THEN 'FRENO'

    WHEN UPPER(p.nombre) LIKE '%CAMARA%'
      OR UPPER(p.nombre) LIKE '%CÁMARA%'
        THEN 'CÁMARA'

    WHEN UPPER(p.nombre) LIKE '%CUBIERTA%'
        THEN 'CUBIERTA BICICLETA'

    WHEN UPPER(p.nombre) LIKE '%RAYO%'
      OR UPPER(p.nombre) LIKE '%RAYOS%'
        THEN 'RAYO'

    WHEN UPPER(p.nombre) LIKE '%LLANTA%'
        THEN 'LLANTA'

    WHEN UPPER(p.nombre) LIKE '%CAJA PEDALERA%'
        THEN 'CAJA PEDALERA'

    WHEN UPPER(p.nombre) LIKE '%PEDAL%'
      OR UPPER(p.nombre) LIKE '%PEDALES%'
      OR UPPER(p.nombre) LIKE '%PEDALIN%'
      OR UPPER(p.nombre) LIKE '%PEDALÍN%'
        THEN 'PEDAL / PEDALÍN'

    WHEN UPPER(p.nombre) LIKE '%PALANCA%'
        THEN 'PALANCA'

    WHEN UPPER(p.nombre) LIKE '%DIRECCION%'
      OR UPPER(p.nombre) LIKE '%DIRECCIÓN%'
      OR UPPER(p.nombre) LIKE '%AHEAD%'
        THEN 'DIRECCIÓN / AHEAD'

    WHEN UPPER(p.nombre) LIKE '%SUSPENSION%'
      OR UPPER(p.nombre) LIKE '%SUSPENSIÓN%'
      OR UPPER(p.nombre) LIKE '%HORQUILLA%'
        THEN 'SUSPENSIÓN / HORQUILLA'

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

    WHEN UPPER(p.nombre) LIKE '%GUARDABARRO%'
      OR UPPER(p.nombre) LIKE '%GUARDABARROS%'
        THEN 'GUARDABARROS'

    WHEN UPPER(p.nombre) LIKE '%ACEITE%'
      OR UPPER(p.nombre) LIKE '%LUBRICANTE%'
      OR UPPER(p.nombre) LIKE '%GRASA%'
      OR UPPER(p.nombre) LIKE '%SLIME%'
      OR UPPER(p.nombre) LIKE '%SELLADOR%'
        THEN 'LUBRICANTE / MANTENIMIENTO'

    WHEN UPPER(p.nombre) LIKE '%RUEDA ARMADA%'
        THEN 'RUEDA ARMADA'

    ELSE NULL
END
WHERE p.subtipo_catalogo IS NULL;
