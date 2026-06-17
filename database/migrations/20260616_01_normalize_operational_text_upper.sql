BEGIN;

UPDATE clientes
SET
    nombre = UPPER(BTRIM(nombre)),
    razon_social = NULLIF(UPPER(BTRIM(COALESCE(razon_social, ''))), '')
WHERE nombre IS NOT NULL;

UPDATE bicicletas_clientes
SET
    marca = UPPER(BTRIM(marca)),
    modelo = UPPER(BTRIM(modelo)),
    color = NULLIF(UPPER(BTRIM(COALESCE(color, ''))), '')
WHERE marca IS NOT NULL
   OR modelo IS NOT NULL
   OR color IS NOT NULL;

UPDATE categorias
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE marcas
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE productos
SET
    nombre = UPPER(BTRIM(nombre)),
    tipo_bicicleta = NULLIF(UPPER(BTRIM(COALESCE(tipo_bicicleta, ''))), ''),
    material_cuadro = NULLIF(UPPER(BTRIM(COALESCE(material_cuadro, ''))), '')
WHERE nombre IS NOT NULL;

UPDATE variantes
SET
    nombre_variante = UPPER(BTRIM(nombre_variante)),
    talle = NULLIF(UPPER(BTRIM(COALESCE(talle, ''))), ''),
    color = NULLIF(UPPER(BTRIM(COALESCE(color, ''))), ''),
    codigo_proveedor = NULLIF(UPPER(BTRIM(COALESCE(codigo_proveedor, ''))), '')
WHERE nombre_variante IS NOT NULL;

UPDATE familias_precio
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE proveedores
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE servicios_taller
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE ordenes_taller
SET problema_reportado = UPPER(BTRIM(problema_reportado))
WHERE problema_reportado IS NOT NULL;

UPDATE cotizaciones
SET
    cliente_nombre_snapshot = NULLIF(UPPER(BTRIM(COALESCE(cliente_nombre_snapshot, ''))), ''),
    problema_reportado = NULLIF(UPPER(BTRIM(COALESCE(problema_reportado, ''))), '')
WHERE cliente_nombre_snapshot IS NOT NULL
   OR problema_reportado IS NOT NULL;

UPDATE sucursales
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

UPDATE usuarios
SET nombre = UPPER(BTRIM(nombre))
WHERE nombre IS NOT NULL;

COMMIT;
