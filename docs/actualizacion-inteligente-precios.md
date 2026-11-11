# Actualizacion inteligente de precios

## Estado del documento

- Estado general: en implementacion
- Fase activa: Fase 0 - validacion con archivos reales antes del motor de precios
- Ultima actualizacion: 2026-11-02
- Objetivo: convertir el modulo `Precios` en una herramienta segura para importar listas de proveedores, actualizar costos de reposicion y recalcular precios de venta en lote sin modificar stock ni costos historicos.

Este documento es la fuente de verdad para implementar la mejora del modulo de precios. Se debe actualizar al comenzar y terminar cada fase, al cambiar una regla comercial, al descubrir una excepcion de proveedor y al modificar una formula.

## Protocolo para retomar el trabajo

Antes de continuar una fase:

1. Leer este documento completo.
2. Revisar `Estado del documento`, `Registro de fases` y `Registro de decisiones`.
3. Comparar lo documentado con el codigo, la base y las migraciones actuales.
4. Revisar `git status` y conservar cambios ajenos o pendientes.
5. Implementar solamente el alcance de la fase activa.
6. Ejecutar las pruebas indicadas para esa fase.
7. Actualizar este documento antes de considerar terminada la fase.

La interfaz por si sola no cierra una fase. Tambien deben quedar validados los calculos con `Decimal`, permisos, auditoria, doble clic, rollback, archivos reales y comportamiento movil.

## Problema a resolver

El modulo actual permite:

- Editar un precio puntual.
- Consultar una sugerencia cuando existe una regla activa.
- Aplicar una suba porcentual general por proveedor.
- Recalcular productos desfasados usando reglas.
- Mantener historial de movimientos de precio.

Pero no resuelve la tarea habitual:

1. Recibir una lista Excel o CSV de un proveedor.
2. Encontrar cada producto por su codigo.
3. detectar cuanto cambio su costo.
4. Conservar el margen particular que ya tenia cada producto.
5. Revisar excepciones.
6. Actualizar cientos de precios juntos.

La auditoria del 2026-11-02 encontro:

- 689 variantes activas.
- 689 variantes con proveedor preferido.
- 684 variantes con costo promedio mayor a cero.
- 0 reglas de precio activas.

Por eso el recalculo por reglas actualmente no puede ser el flujo principal. Primero debe existir un importador y una estrategia capaz de conservar el margen individual.

## Resultado esperado

El operador entra en `Precios`, elige un proveedor y sube el archivo original sin limpiarlo manualmente.

El sistema:

1. Reconoce el formato del proveedor o propone un mapeo.
2. Extrae codigo, descripcion, costo, moneda, IVA, descuentos y presentacion.
3. Vincula coincidencias exactas y separa dudas o productos nuevos.
4. Calcula el costo de reposicion nuevo.
5. Compara el costo anterior contra el nuevo.
6. Conserva por defecto el margen individual de cada producto.
7. Permite elegir otra estrategia por fila.
8. Presenta una vista previa antes de modificar el catalogo.
9. Aplica todas las filas seleccionadas en una sola transaccion.
10. Conserva el archivo, formulas, usuario, valores anteriores y valores nuevos.
11. Permite revertir el lote completo cuando no existan conflictos posteriores.

## Alcance y relacion con Recepciones

### Lista de precios

- No ingresa stock.
- No crea movimientos de stock.
- No modifica el costo promedio contable.
- Actualiza el costo de reposicion.
- Puede actualizar precios futuros de venta.

### Recepcion de mercaderia

- Registra mercaderia que ingreso fisicamente.
- Actualiza stock.
- Recalcula el costo promedio real.
- Puede reutilizar el mismo motor de sugerencias de precio.

Los dos modulos pueden compartir lector documental, perfiles de proveedor, coincidencias y formulas, pero no deben compartir la operacion de confirmacion.

## Conceptos de costo

### Costo promedio vigente

Representa el costo real promedio de las unidades que se encuentran en inventario. Se modifica por recepciones o correcciones contables explicitas.

Se utiliza para:

- Valuar inventario.
- Calcular rentabilidad de ventas cuando corresponde.
- Calcular costos de armado, taller y acondicionamiento.

Una lista de precios no debe modificarlo.

### Costo de reposicion

Representa cuanto costaria volver a comprar hoy una unidad al proveedor.

Se utiliza para:

- Proponer precios nuevos.
- Detectar aumentos y bajas de proveedor.
- Medir si el precio actual quedo atrasado.
- Preparar compras futuras.

Debe conservar:

- Importe.
- Moneda.
- Fecha de vigencia.
- Proveedor.
- Lote de actualizacion.
- Origen del dato.

Al crear el campo por primera vez, se puede inicializar con el costo promedio vigente. Esa copia inicial debe quedar identificada como migracion y no como lista confirmada por un proveedor.

## Margen individual

La estrategia predeterminada sera `conservar_margen`.

Cada variante puede tener un margen distinto aunque pertenezca al mismo rubro. Minorista y mayorista se calculan por separado.

### Formula base

Para un canal comercial:

```text
precio_efectivo_actual = precio_lista_actual * (1 - descuento_aplicable)
margen_actual = (precio_efectivo_actual / costo_base_anterior) - 1
precio_efectivo_nuevo = costo_reposicion_nuevo * (1 + margen_actual)
precio_lista_nuevo = precio_efectivo_nuevo / (1 - descuento_aplicable)
precio_lista_redondeado = redondear_hacia_arriba(precio_lista_nuevo)
```

El costo base anterior sera:

1. Ultimo costo de reposicion confirmado.
2. Como respaldo inicial, costo promedio vigente.

Si no existe costo anterior valido, no se puede derivar el margen. La fila queda para revision y puede usar una regla o un precio manual.

### Estrategias disponibles por fila

- `conservar_margen`: mantiene el margen individual calculado.
- `usar_regla`: usa la regla comercial mas especifica aplicable.
- `mantener_precio`: actualiza solamente el costo de reposicion.
- `manual`: el operador define minorista y mayorista.
- `ignorar`: la fila no produce cambios.

### Protecciones

- Una baja de costo no reduce precios automaticamente.
- Una variacion absoluta desde 10% genera alerta.
- Costo cero, negativo o ilegible bloquea la fila.
- Precio resultante menor al minimo comercial genera alerta o bloqueo segun configuracion.
- Productos con precio libre requieren confirmacion explicita.
- Productos en oferta muestran el precio normal, la oferta vigente y el impacto por separado.
- No se recalculan ventas, reservas, presupuestos ni ordenes ya creadas.

## Lectura de archivos

### Formatos iniciales

- XLSX.
- CSV.
- Texto tabulado pegado.

PDF e imagen pueden incorporarse despues reutilizando el lector de Recepciones, pero no deben retrasar el circuito confiable de archivos estructurados.

### El operador no limpia el archivo

El sistema debe aceptar el archivo original del proveedor. La primera vez puede solicitar confirmar:

- Hoja correcta.
- Fila de encabezados.
- Columna de codigo.
- Columna de descripcion.
- Columna de costo.
- Columna de moneda.
- IVA incluido o excluido.
- Descuentos generales o por renglon.
- Unidades por envase o bulto.
- Vigencia de la lista.

La configuracion confirmada se guarda como perfil del proveedor.

### Perfil de formato por proveedor

El perfil debe incluir:

- Proveedor.
- Nombre o patron del archivo.
- Hoja preferida.
- Fila de encabezado.
- Alias conocidos de columnas.
- Columnas seleccionadas.
- Reglas de normalizacion de codigo.
- Tratamiento de IVA.
- Tratamiento de descuentos.
- Moneda predeterminada.
- Presentacion o multiplicador por unidad.
- Usuario y fecha de confirmacion.
- Cantidad de usos y correcciones.

Si el formato cambia, el sistema no debe aplicar silenciosamente el perfil viejo. Debe comparar encabezados, bajar la confianza y pedir revision.

## Coincidencias de productos

Prioridad:

1. Proveedor y codigo exacto.
2. EAN exacto.
3. SKU interno exacto.
4. Alias de codigo previamente confirmado.
5. Codigo normalizado como sugerencia.
6. Descripcion similar como sugerencia.

Reglas:

- Codigo exacto, EAN exacto o alias confirmado pueden vincular automaticamente.
- Quitar o agregar ceros al codigo solo puede sugerir una coincidencia hasta que se confirme el alias.
- La descripcion nunca confirma sola.
- Una coincidencia con mas de un candidato queda bloqueada.
- Un codigo nuevo no crea automaticamente un producto desde una lista de precios.
- Las coincidencias confirmadas se recuerdan para el mismo proveedor.

## Estados de un lote

- `borrador`: archivo cargado, todavia editable.
- `procesando`: lectura en curso.
- `requiere_revision`: existen filas dudosas, invalidas o sin estrategia.
- `listo_para_aplicar`: todas las filas seleccionadas son validas.
- `aplicado`: costos de reposicion y precios confirmados.
- `revertido`: cambios del lote compensados de forma auditable.
- `anulado`: borrador descartado sin impacto.
- `error`: procesamiento fallido y reintentable.

Un lote aplicado no se edita. Una correccion genera una reversion o un nuevo lote.

## Vista previa

La tabla principal debe mostrar:

- Estado de coincidencia.
- Codigo del proveedor.
- Producto y variante.
- Costo de reposicion anterior.
- Costo nuevo.
- Diferencia en pesos y porcentaje.
- Precio minorista actual y sugerido.
- Margen minorista actual y resultante.
- Precio mayorista actual y sugerido.
- Margen mayorista actual y resultante.
- Regla aplicada cuando corresponda.
- Oferta vigente.
- Estrategia elegida.
- Alertas.
- Casilla para aplicar.

Filtros rapidos:

- Todos.
- Encontrados.
- Aumentos.
- Bajas.
- Alerta mayor al 10%.
- Sin coincidencia.
- Duplicados.
- Sin costo anterior.
- En oferta.
- Seleccionados.

Acciones masivas:

- Conservar margen.
- Usar regla.
- Mantener precio.
- Seleccionar aumentos seguros.
- Deseleccionar bajas.
- Ignorar seleccionados.

## Aplicacion transaccional

Al confirmar:

1. Bloquear el lote para evitar doble aplicacion.
2. Volver a leer las variantes afectadas con bloqueo de escritura.
3. Verificar que sus precios y costos de reposicion no hayan cambiado desde la vista previa.
4. Si existe conflicto, abortar todo el lote y mostrar las filas afectadas.
5. Actualizar costo de reposicion y precios seleccionados.
6. Crear movimientos de precio vinculados al lote.
7. Registrar auditoria y responsable.
8. Marcar el lote como aplicado.
9. Confirmar toda la transaccion.

Si una fila falla, no se aplica ninguna.

## Reversion

La reversion debe:

- Mostrar los valores que intentara restaurar.
- Detectar modificaciones posteriores sobre las mismas variantes.
- Bloquear la reversion automatica si pisaria un cambio posterior.
- Restaurar costo de reposicion y precios cuando no existan conflictos.
- Crear movimientos compensatorios; nunca borrar historial.
- Registrar motivo, usuario y fecha.

## Reorganizacion del modulo Precios

### 1. Actualizar precios

Pantalla inicial y flujo principal.

- Subir lista de proveedor.
- Aplicar aumento general.
- Revisar desfasados.
- Continuar lotes pendientes.

### 2. Catalogo de precios

- Buscar producto.
- Ver costos, margenes y precios.
- Editar un caso puntual.
- Consultar historial.

### 3. Ofertas

Conserva el modulo actual y muestra advertencias cuando un lote modifica el precio normal de un producto ofertado.

### 4. Historial

- Lotes importados.
- Actualizaciones manuales.
- Ajustes generales.
- Responsable.
- Archivo original.
- Reversiones.

### 5. Configuracion

- Reglas comerciales.
- Redondeos.
- Descuentos por canal.
- Perfiles de proveedor.
- Umbral de alerta.

La calculadora deja de ser una pantalla principal y se integra en la edicion puntual y la vista previa.

## Modelo de datos propuesto

### Variantes

Agregar, como minimo:

- `costo_reposicion`.
- `costo_reposicion_moneda`.
- `costo_reposicion_fecha`.
- `costo_reposicion_proveedor_id`.
- `costo_reposicion_lote_id`.

### Lotes de actualizacion

Cabecera sugerida:

- Proveedor.
- Estado.
- Archivo original, hash y tipo MIME.
- Moneda.
- Fecha de vigencia.
- Perfil de lectura utilizado.
- Usuario creador, confirmador y revisor.
- Totales de filas por estado.
- Fecha de aplicacion o reversion.
- Motivo.

### Items del lote

Congelar por fila:

- Datos originales extraidos.
- Producto vinculado.
- Tipo y confianza de coincidencia.
- Costos anterior y nuevo.
- Precios anteriores y nuevos.
- Margenes anteriores y nuevos.
- Descuento y redondeo utilizados.
- Regla utilizada.
- Estrategia.
- Alertas.
- Seleccion de aplicacion.

### Perfiles de proveedor

Guardar configuracion de lectura y estadisticas de aciertos o correcciones.

### Historial existente

Reutilizar `precio_movimientos`, agregando referencia al lote cuando sea necesario. No crear un segundo historial que pueda contradecir al actual.

## Fases de implementacion

### Fase 0 - Reglas y auditoria final

Estado: activa.

Objetivo: cerrar formulas, campos y casos excepcionales antes de modificar datos.

- [x] Auditar modulo actual y reglas activas.
- [x] Confirmar que el margen individual es la estrategia predeterminada.
- [x] Separar costo promedio de costo de reposicion.
- [x] Decidir que las bajas no reducen precios automaticamente.
- [x] Definir alerta inicial desde 10%.
- [ ] Confirmar descuento aplicable a minorista y mayorista.
- [ ] Definir redondeo predeterminado por canal.
- [ ] Validar al menos dos archivos reales de proveedores diferentes.
- [ ] Confirmar tratamiento inicial de IVA, moneda y descuentos de lista.

Criterio de cierre: dos listas reales pueden convertirse manualmente en la misma estructura normalizada y todas las formulas producen resultados esperados conocidos.

### Fase 1 - Costo de reposicion

Estado: completada.

Objetivo: incorporar el nuevo costo sin alterar inventario ni rentabilidad historica.

- [x] Crear migracion.
- [x] Inicializar desde costo promedio con origen `migracion_costo_promedio`.
- [x] Exponer costo promedio y costo de reposicion con etiquetas claras.
- [x] Adaptar sugerencias de precio para usar reposicion con fallback controlado.
- [x] Proteger permisos y datos sensibles.
- [x] Agregar historial y auditoria.

Validacion: 87 pruebas de precios, stock, recepciones y pedidos aprobadas. El build de frontend tambien finaliza correctamente. La migracion operativa inicializo 689 variantes y no dejo variantes con costo promedio positivo sin costo de reposicion. Una entrada real de stock actualiza el costo promedio ponderado y guarda el costo del ultimo lote como reposicion; una lista o correccion manual de reposicion no modifica existencias ni el promedio.

Criterio de cierre: actualizar costo de reposicion no modifica stock, costo promedio ni ventas anteriores, pero cambia correctamente una sugerencia futura.

### Fase 2 - Lotes y carga de archivos

Estado: completada.

Objetivo: crear un borrador persistente y conservar el archivo original.

- [x] Crear tablas de lote, items, documentos y perfiles.
- [x] Permitir XLSX, CSV y texto tabulado.
- [x] Detectar hoja, encabezado y columnas probables.
- [x] Mostrar lectura antes de guardar el perfil.
- [x] Detectar archivos duplicados por hash.
- [x] Permitir anular borradores.

Validacion: el lector conserva las filas y los textos originales, incluidos codigos con ceros a la izquierda. Se probaron XLSX con varias hojas y encabezado desplazado, CSV con punto y coma y decimales argentinos, y TXT tabulado. Un archivo repetido queda bloqueado por SHA-256 y remite al lote existente. La anulacion conserva el documento para auditoria. La migracion fue aplicada en las bases de prueba y operativa; 86 pruebas de regresion aprobaron y el frontend compila correctamente.

Criterio de cierre: cargar el mismo archivo dos veces no duplica trabajo y el borrador conserva exactamente los valores leidos.

### Fase 3 - Coincidencias y aprendizaje por proveedor

Estado: completada.

Objetivo: resolver productos sin actualizaciones peligrosas.

- [x] Coincidir por proveedor y codigo exacto.
- [x] Coincidir por EAN y SKU exactos.
- [x] Sugerir codigos normalizados y descripciones similares.
- [x] Crear y reutilizar alias confirmados.
- [x] Resolver duplicados y ambiguedades.
- [x] Recordar decisiones por proveedor.

Validacion: las coincidencias automaticas se limitan a alias del proveedor, SKU exacto, EAN unico y codigo exacto del proveedor preferido. Los codigos normalizados y las descripciones similares solo generan candidatos explicados y requieren confirmacion. La interfaz permite vincular una sugerencia, buscar otra variante, deshacer la coincidencia y reemplazar de forma explicita un alias aprendido incorrectamente. El aprendizaje se comparte con Recepciones mediante `proveedor_producto_codigos`. Aprobaron 77 pruebas conjuntas de listas, precios, recepciones y stock, mas los casos especificos de reemplazo de alias; el frontend compila correctamente.

Criterio de cierre: ninguna descripcion similar actualiza un producto sin confirmacion y los formatos habituales requieren revisar solo excepciones.

### Fase 4 - Motor de precios y vista previa

Estado: completada.

Objetivo: calcular propuestas explicables por fila.

- [x] Implementar `conservar_margen` por canal.
- [x] Integrar `usar_regla`, `mantener_precio`, `manual` e `ignorar`.
- [x] Aplicar descuento contado y redondeo configurados.
- [x] Mostrar ofertas y precios libres.
- [x] Alertar variaciones, costos invalidos y margenes inseguros.
- [x] Permitir acciones masivas y edicion individual.
- [x] Congelar todos los insumos del calculo en el item.

Validacion: la vista previa conserva el margen efectivo despues del descuento contado por canal, redondea hacia arriba y no reduce precios automaticamente cuando baja el costo. Permite usar reglas comerciales, mantener precios, definir importes manuales o ignorar filas. Congela costos, precios, margenes, descuentos, redondeos, reglas y ofertas en cada item; los productos de precio libre requieren confirmacion explicita. La pantalla compara valores anteriores y propuestos, expone alertas y permite corregir cada fila sin modificar `variantes`. Aprobaron 10 pruebas especificas y 81 pruebas conjuntas de listas, precios, recepciones y stock. El frontend compila correctamente y la migracion fue aplicada en las bases de prueba y operativa.

Criterio de cierre: la misma entrada siempre produce la misma vista previa y cada importe puede explicarse con sus componentes.

### Fase 5 - Aplicacion, historial y reversion

Estado: completada.

Objetivo: aplicar lotes de manera atomica y recuperable.

- [x] Verificar conflictos desde la vista previa.
- [x] Aplicar en una unica transaccion.
- [x] Hacer la confirmacion idempotente.
- [x] Vincular movimientos de precio.
- [x] Registrar auditoria completa.
- [x] Implementar reversion con deteccion de cambios posteriores.
- [x] Descargar informe de aplicacion.

Validacion: antes de aplicar se bloquean y comparan el costo efectivo y ambos precios de cada variante contra la version congelada en la vista previa. Un conflicto cancela la transaccion completa. Cada fila aplicada crea un movimiento en `precios_movimientos`, conserva los metadatos anteriores del costo de reposicion y queda vinculada a ese movimiento. Aplicar o revertir dos veces es idempotente. La reversion exige que el movimiento del lote siga siendo el ultimo de cada producto y que los valores actuales coincidan con los aplicados; cualquier cambio posterior bloquea toda la reversion. El PDF final lista costos y precios anteriores y nuevos. Aprobaron 14 pruebas especificas y 85 pruebas conjuntas de listas, precios, recepciones y stock. El frontend compila correctamente y la migracion fue aplicada en las bases de prueba y operativa.

Criterio de cierre: una falla intermedia no deja productos parcialmente actualizados y un lote sin conflictos puede revertirse sin borrar historial.

### Fase 6 - Reorganizacion de la interfaz

Estado: completada.

Objetivo: convertir `Precios` en una tarea diaria clara.

- [x] Hacer `Actualizar precios` la entrada principal.
- [x] Crear bandeja de lotes pendientes y recientes.
- [x] Integrar desfasados y ajuste general como acciones secundarias.
- [x] Mover reglas y perfiles a Configuracion.
- [x] Integrar calculadora en contexto.
- [x] Mejorar tablas para escritorio y movil.
- [x] Incorporar busqueda, filtros y seleccion persistente.

Validacion: `Precios` abre directamente en la bandeja de actualizaciones y separa pendientes de historial. La carga de una lista aparece solo cuando el operador la solicita; la lectura original y los ajustes de calculo quedan plegados luego de generar la vista previa para mantener el foco en las excepciones. La bandeja permite buscar y filtrar por proveedor, conserva la seccion, los filtros y el lote seleccionado, y la revision permite buscar renglones o mostrar solo alertas y pendientes. Los ajustes masivos, la calculadora y la configuracion quedaron como herramientas secundarias; Configuracion reune las reglas comerciales y los formatos aprendidos por proveedor. En movil, la vista previa usa fichas por producto en lugar de una tabla horizontal inaccesible. El frontend compila correctamente y las pruebas de precios, lotes y contratos moviles aprobaron.

Criterio de cierre: un operador puede cargar, revisar y aplicar una lista sin navegar entre herramientas desconectadas.

### Fase 7 - Integraciones y aprendizaje operativo

Estado: en curso.

Objetivo: reutilizar el motor en el resto del sistema y medir su calidad.

- [x] Compartir formulas con Recepciones sin mezclar confirmaciones.
- [x] Mostrar costo de reposicion en compras y catalogo administrativo.
- [ ] Permitir que Atenea explique un lote en modo solo lectura.
- [ ] Medir coincidencias automaticas, correcciones y tiempos.
- [ ] Detectar cambios de formato por proveedor.
- [ ] Comparar sugerencias contra precios finalmente confirmados.

Criterio de cierre: el sistema aprende formatos y decisiones repetidas sin adquirir permiso para aplicar cambios silenciosamente.

Avance 2026-11-03: Listas de precios y Recepciones utilizan `precios.motor.calcular_vista_previa_precios` como fuente comun para reglas, conservacion de margen efectivo, descuentos, redondeos, alertas, ofertas y productos de precio libre. Recepciones usa el costo unitario final conciliado como costo de reposicion para la decision comercial; el costo promedio ponderado continua separado para valuacion y rentabilidad. La vista previa de la recepcion conserva su propia confirmacion y no modifica catalogo ni stock hasta confirmar el ingreso. La pantalla informa esta separacion, usa el descuento contado configurado, alerta desde 10% y exige confirmacion explicita para productos de precio libre. Aprobaron 52 pruebas de listas y recepciones y el frontend compila correctamente.

Avance 2026-11-11: Catalogo administrativo muestra por separado costo promedio de stock y costo de reposicion, incluyendo fecha, origen y proveedor cuando estan disponibles. Stock bajo y pedidos de compra transportan ambos valores; la compra estimada prioriza reposicion y avisa cuando debe usar el promedio como respaldo. Los costos quedan ocultos para usuarios sin permisos de precios o rentabilidad. Pantalla y CSV de reposicion usan la misma referencia de compra.

## Pruebas obligatorias

- Lectura de XLSX con una y varias hojas.
- Lectura de CSV con coma, punto y coma y formatos argentinos.
- Encabezados desplazados y filas informativas antes de la tabla.
- Codigos numericos, texto, ceros a la izquierda y sufijos.
- Costos con punto o coma decimal.
- IVA incluido y excluido.
- Descuento general y por renglon.
- Presentaciones por unidad, par, caja o bulto.
- Archivo duplicado.
- Codigo exacto y alias confirmado.
- Coincidencia ambigua bloqueada.
- Producto nuevo sin alta automatica.
- Conservacion exacta de margen minorista y mayorista.
- Descuento contado y redondeo hacia arriba.
- Baja de costo sin baja automatica de precio.
- Alerta desde 10%.
- Producto en oferta.
- Costo anterior cero o inexistente.
- Producto con precio libre.
- Preview sin efectos en catalogo.
- Aplicacion transaccional e idempotente.
- Rollback total ante una falla.
- Reversion sin conflictos.
- Reversion bloqueada ante cambios posteriores.
- Permisos para ver costos y aplicar precios.
- Render movil sin columnas inaccesibles.

## Fuera de alcance inicial

- Descargar listas automaticamente desde portales de proveedores.
- Convertir una lista en ingreso de stock.
- Crear productos nuevos sin revision.
- Modificar ventas historicas.
- Bajar precios automaticamente.
- Actualizar ofertas sin confirmacion.
- Usar una IA para realizar calculos monetarios.
- Confirmar lotes sin intervencion humana.

## Registro de decisiones

| Fecha | Decision | Motivo |
| --- | --- | --- |
| 2026-11-02 | La mejora vive dentro del modulo `Precios`, no en un modulo paralelo. | Reutilizar historial, permisos, reglas, ofertas y edicion puntual existentes. |
| 2026-11-02 | El operador sube el archivo original; no debe limpiarlo manualmente. | Evitar trabajo repetido y errores de transcripcion. |
| 2026-11-02 | Cada proveedor conserva un perfil de lectura revisable. | Los proveedores usan formatos diferentes pero suelen repetir su propio formato. |
| 2026-11-02 | El costo promedio y el costo de reposicion son conceptos distintos. | Una lista no representa una compra ni debe revaluar inventario. |
| 2026-11-02 | La estrategia predeterminada es conservar el margen individual por producto y canal. | Productos del mismo rubro pueden tener decisiones comerciales diferentes. |
| 2026-11-02 | Las reglas por rubro son respaldo, no obligacion universal. | Resolver productos sin historial o decisiones masivas sin pisar excepciones. |
| 2026-11-02 | Las bajas de costo requieren decision manual para bajar precios. | Proteger margen y evitar reducciones comerciales silenciosas. |
| 2026-11-02 | Variaciones desde 10% requieren advertencia. | Detectar errores de lectura y cambios sensibles. |
| 2026-11-02 | Solo coincidencias exactas o alias confirmados pueden automatizarse. | Evitar actualizar el producto equivocado. |
| 2026-11-02 | Todo lote aplicado debe ser transaccional, idempotente y auditable. | Evitar cambios parciales, dobles clics y perdida de trazabilidad. |

## Registro de fases

| Fase | Estado | Inicio | Cierre | Resultado |
| --- | --- | --- | --- | --- |
| 0 - Reglas y auditoria final | Activa | 2026-11-02 | - | Documento inicial, auditoria y decisiones base registradas. |
| 1 - Costo de reposicion | Completada | 2026-11-02 | 2026-11-02 | Costo independiente, fallback controlado, UI, historial, auditoria y pruebas. |
| 2 - Lotes y archivos | Completada | 2026-11-02 | 2026-11-02 | Borradores persistentes, archivos originales, deteccion de estructura, perfiles, duplicados y anulacion. |
| 3 - Coincidencias | Completada | 2026-11-02 | 2026-11-02 | Coincidencias seguras, sugerencias explicables, resolucion manual y aprendizaje por proveedor. |
| 4 - Motor y preview | Completada | 2026-11-02 | 2026-11-02 | Motor explicable por canal, snapshots, alertas y edicion masiva o individual sin efectos en catalogo. |
| 5 - Aplicacion y reversion | Completada | 2026-11-02 | 2026-11-02 | Aplicacion atomica e idempotente, historial oficial, reversion protegida e informe PDF. |
| 6 - Interfaz | Completada | 2026-11-02 | 2026-11-02 | Bandeja diaria, navegacion simplificada, filtros persistentes, configuracion agrupada y revision movil por producto. |
| 7 - Integraciones | En curso | 2026-11-03 | - | Motor comercial compartido con Recepciones sin unir las confirmaciones de precio y stock. |

## Pendientes para cerrar Fase 0

1. Reunir al menos dos archivos reales de proveedores distintos.
2. Confirmar si mayorista recibe descuento contado y que porcentaje usa.
3. Confirmar redondeo habitual para minorista y mayorista.
4. Confirmar como informa cada proveedor IVA y descuentos.
5. Elegir un lote real pequeno y calcular manualmente los resultados esperados para usarlo como prueba de aceptacion.

## Proximo paso

Validar al menos dos archivos reales de proveedores distintos para cerrar la Fase 0. La siguiente etapa es la Fase 7: integrar el motor con Recepciones, Catalogo y Atenea, y medir la calidad del aprendizaje operativo.
