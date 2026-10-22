# Recepcion inteligente de mercaderia

## Estado del documento

- Estado general: en implementacion
- Fase activa: Fase 7 - operacion asistida y aprendizaje
- Ultima actualizacion: 2026-09-28
- Objetivo: recibir documentos de compra, preparar el catalogo, calcular costos e ingresar stock desde una unica tarea del sistema.

Este documento es la fuente de verdad para implementar la recepcion inteligente por fases. Se debe actualizar al comenzar y terminar cada fase, al cambiar una decision funcional y al descubrir una regla contable u operativa nueva.

## Problema a resolver

Hoy una recepcion puede exigir varios trabajos separados:

1. Leer factura, pedido o lista del proveedor.
2. Calcular descuentos y costos finales.
3. Buscar cada codigo en el sistema.
4. Crear manualmente los productos nuevos.
5. Clasificar rubro, categoria, subtipo y marca.
6. Definir precios de venta.
7. Ingresar las cantidades al stock.

Esto consume tiempo y permite errores de transcripcion, productos duplicados, costos incorrectos y clasificaciones inconsistentes.

## Resultado esperado

El operador crea una tarea llamada **Nueva recepcion**, elige el proveedor y carga uno o mas documentos. El sistema procesa la informacion y presenta un borrador conciliado.

El operador solo debe:

1. Revisar advertencias.
2. Resolver coincidencias dudosas.
3. Completar datos que el sistema no pudo determinar.
4. Confirmar el ingreso.

Al confirmar, el sistema crea los productos nuevos, actualiza costos y precios autorizados, registra el ingreso de stock y conserva la documentacion y la auditoria.

## Flujo operativo final

Estados de una recepcion:

1. `borrador`: tarea creada, todavia editable.
2. `procesando`: documentos en lectura y normalizacion.
3. `requiere_revision`: existen datos faltantes, diferencias o coincidencias dudosas.
4. `lista_para_confirmar`: todos los controles obligatorios fueron aprobados.
5. `confirmada`: catalogo, costos y stock actualizados.
6. `anulada`: tarea descartada sin impacto operativo.
7. `error`: el procesamiento fallo y puede reintentarse.

Una recepcion confirmada no se edita. Cualquier correccion posterior debe generar una operacion compensatoria auditable.

## Responsabilidades de la IA

La IA puede:

- Leer PDF, imagen, Excel o texto pegado.
- Extraer codigos, descripciones, cantidades, precios, impuestos y descuentos.
- Interpretar abreviaturas del proveedor.
- Proponer nombre comercial limpio.
- Sugerir marca, rubro, categoria y subtipo.
- Proponer posibles coincidencias con productos existentes.
- Explicar inconsistencias encontradas.

La IA no puede:

- Confirmar una recepcion.
- Escribir directamente en stock o catalogo.
- Decidir silenciosamente que dos productos son iguales.
- Inventar importes faltantes.
- Reemplazar el motor matematico de costos.

Toda salida de IA se considera una sugerencia dentro de un borrador.

## Reglas no negociables

- Los calculos monetarios usan `Decimal`, nunca flotantes.
- Ninguna recepcion impacta stock antes de la confirmacion final.
- La confirmacion completa debe ejecutarse en una unica transaccion.
- Si una linea falla, no se confirma ninguna linea.
- Cada producto debe buscarse primero por proveedor y codigo de proveedor.
- Una coincidencia dudosa requiere decision humana.
- El total distribuido debe conciliar contra los documentos aceptados.
- Una diferencia distinta de cero bloquea la confirmacion, salvo ajuste explicito y auditado.
- Los productos nuevos requieren como minimo nombre, rubro, categoria, variante, proveedor y codigo de proveedor.
- Los costos, descuentos y reglas de precio utilizados quedan congelados como snapshot.
- Cada confirmacion registra usuario, fecha, documentos y resultado.
- Reprocesar el mismo documento no puede duplicar ingresos.

## Conciliacion de costos

El motor deterministico debe explicar el costo de cada linea:

```text
importe bruto de linea
- descuento de linea
- descuento general prorrateado
- nota de credito aplicable
+ gastos adicionales prorrateados
+ impuestos no recuperables
= costo total de linea
/ cantidad recibida
= costo final unitario
```

La recepcion debe mostrar:

- Subtotal bruto.
- Descuentos por linea.
- Descuento general.
- Notas de credito.
- Gastos adicionales.
- Impuestos incluidos y tratamiento aplicado.
- Total documental.
- Total calculado.
- Diferencia de conciliacion.

### Decisiones contables pendientes

- [ ] Definir tratamiento del IVA segun condicion fiscal del negocio.
- [ ] Definir si una nota de credito se aplica a lineas concretas o se prorratea.
- [ ] Definir metodo de prorrateo: por importe, cantidad, peso u otro criterio.
- [ ] Definir tratamiento de flete, percepciones y otros gastos.
- [ ] Definir redondeo oficial y manejo de centavos residuales.

## Coincidencia con catalogo

Cada linea importada debe quedar en uno de estos estados:

- `exacta`: proveedor y codigo coinciden con una variante.
- `sugerida`: existe una posible coincidencia por descripcion, marca o codigo alternativo.
- `nueva`: no existe una coincidencia razonable.
- `conflicto`: el codigo apunta a mas de una variante o contradice datos existentes.
- `incompleta`: faltan datos obligatorios.

Colores de interfaz:

- Verde: coincidencia exacta.
- Amarillo: requiere revision.
- Azul: alta nueva preparada.
- Rojo: bloqueante.

La relacion entre proveedor, codigo externo y variante debe persistirse para que el sistema aprenda de las confirmaciones anteriores sin depender nuevamente de IA.

## Actualizacion de precios

Para cada linea se debe presentar:

- Costo anterior.
- Costo nuevo.
- Variacion porcentual.
- Precio minorista actual y sugerido.
- Precio mayorista actual y sugerido.
- Margen actual y margen resultante.

Opciones por recepcion:

- Mantener precios actuales.
- Mantener el margen actual.
- Aplicar una regla de margen configurada.
- Editar precios manualmente por linea.

La actualizacion masiva siempre requiere vista previa.

## Modelo funcional propuesto

Entidades nuevas o equivalentes:

- `recepciones_mercaderia`: cabecera, proveedor, sucursal, estado y totales.
- `recepcion_documentos`: archivos, tipo, hash y resultado de extraccion.
- `recepcion_items`: datos originales, datos normalizados, costos y resolucion.
- `recepcion_ajustes`: descuentos, notas de credito, flete, impuestos y prorrateos.
- `proveedor_producto_codigos`: relacion entre proveedor, codigo externo y variante.
- `recepcion_eventos`: historial completo de procesamiento y decisiones.

Se reutilizan:

- Productos, variantes, marcas, rubros y categorias existentes.
- Proveedores existentes.
- Ingresos de stock individuales y por lote.
- Reglas actuales de costo promedio.
- Auditoria y permisos del sistema.

## Fases de implementacion

### Fase 0 - Relevamiento y reglas

Objetivo: cerrar las reglas antes de diseñar el calculo definitivo.

- [ ] Relevar esquemas actuales de catalogo, variantes, proveedores, precios e ingresos.
- [ ] Documentar como se calcula hoy el costo promedio.
- [ ] Reunir ejemplos reales: factura, pedido, nota de credito y lista procesada.
- [ ] Resolver las decisiones contables pendientes.
- [ ] Definir permisos para crear, revisar, confirmar y anular recepciones.

Criterio de cierre: reglas funcionales y monetarias escritas sin ambiguedades.

### Fase 1 - Tarea y borrador por tabla

Objetivo: eliminar inmediatamente la carga linea por linea, sin depender aun de lectura de PDF.

- [x] Crear listado de recepciones.
- [x] Crear una nueva recepcion con proveedor y sucursal.
- [x] Permitir pegar una tabla o importar CSV.
- [x] Incorporar importacion directa de XLSX.
- [x] Interpretar codigo, descripcion, cantidad y costo unitario.
- [x] Guardar borrador sin modificar catalogo ni stock.
- [x] Mostrar errores de formato por fila.

Criterio de cierre: una lista como la del ejemplo genera todas sus lineas en una sola tarea.

### Fase 2 - Coincidencias y altas preparadas

Objetivo: separar productos existentes, nuevos y dudosos.

- [x] Buscar coincidencia exacta por proveedor y codigo.
- [x] Incorporar codigos alternativos por proveedor.
- [ ] Proponer coincidencias por datos normalizados.
- [x] Preparar altas nuevas con SKU interno automatico.
- [x] Sugerir marca, rubro, categoria y subtipo.
- [ ] Permitir edicion masiva y filtros por estado. El filtro por estado ya esta disponible; resta la accion masiva.

Criterio de cierre: ninguna linea queda sin resolucion explicita.

### Fase 3 - Motor de costos y conciliacion

Objetivo: calcular costos finales de manera explicable y reproducible.

- [x] Registrar descuentos por linea y globales.
- [x] Registrar notas de credito.
- [x] Registrar flete, impuestos y gastos adicionales.
- [x] Implementar prorrateos deterministas.
- [x] Mostrar formula y detalle por linea.
- [x] Bloquear diferencias de conciliacion.
- [x] Agregar pruebas de redondeo y centavos residuales.

Criterio de cierre: el total calculado coincide con el total aceptado y cada costo puede explicarse.

### Fase 4 - Confirmacion transaccional

Objetivo: convertir el borrador aprobado en operaciones reales.

- [x] Crear productos y variantes nuevas.
- [x] Vincular codigos externos con variantes.
- [x] Registrar ingresos de stock.
- [x] Actualizar costos promedio.
- [x] Aplicar precios autorizados.
- [x] Guardar snapshots y auditoria.
- [x] Garantizar idempotencia y rollback completo.

Criterio de cierre: una confirmacion correcta impacta todo una sola vez y una falla no deja datos parciales.

### Fase 5 - Lectura inteligente de documentos

Objetivo: eliminar el paso de preparar manualmente la tabla.

- [x] Subir PDF, imagen y Excel desde la recepcion.
- [x] Extraer tablas de Excel y formatos PDF textuales conocidos.
- [x] Extraer texto, coordenadas y confianza con OCR local para imagenes y PDF escaneados.
- [x] Resolver formatos no estructurados con OCR, reproceso y correccion manual asistida.
- [x] Conservar archivo, hash, texto extraido y metadata documental.
- [x] Conservar coordenadas y confianza de los fragmentos reconocidos por OCR.
- [x] Mostrar nivel de confianza por campo y destacar lecturas dudosas.
- [x] Identificar y vincular pedido, factura y nota de credito dentro de una recepcion.
- [x] Detectar y bloquear documentos duplicados por SHA-256.
- [x] Permitir reprocesar un documento sin duplicar la recepcion.

Criterio de cierre: los documentos reales producen el mismo borrador que la importacion estructurada.

Estado: completada el 2026-09-28. Los formatos reconocidos generan lineas automaticamente y los formatos excepcionales pueden corregirse o completarse dentro de la misma recepcion, sin impacto previo sobre stock.

### Fase 6 - Automatizacion de precios

Objetivo: actualizar precios sin perder control comercial.

- [x] Configurar reglas por rubro, categoria, marca, familia o proveedor.
- [x] Mantener margen cuando corresponda.
- [x] Alertar aumentos o bajas atipicas.
- [x] Previsualizar precios antes de aplicar.
- [x] Conservar historial de reglas y modificaciones.

Criterio de cierre: actualizar costos puede recalcular precios de forma masiva, revisable y auditable.

Estado: completada el 2026-09-28. La recepcion proyecta el costo promedio posterior al ingreso, permite aplicar reglas, conservar margen o mantener precios, admite correcciones manuales y solo modifica el catalogo dentro de la confirmacion transaccional. Las reglas y los valores utilizados quedan congelados por linea, y los cambios efectivos generan movimientos de precio vinculados a la recepcion.

### Fase 7 - Operacion asistida y aprendizaje

Objetivo: reducir progresivamente las decisiones manuales repetidas.

- [x] Recordar clasificaciones confirmadas.
- [x] Detectar formatos recurrentes por proveedor.
- [x] Sugerir reglas nuevas sin activarlas automaticamente.
- [x] Medir tiempo de procesamiento y tasa de correcciones.
- [x] Incorporar alertas de posibles duplicados y costos atipicos.
- [x] Permitir deshacer coincidencias automaticas antes de confirmar.
- [x] Explicar cada recepcion desde Atenea en modo solo lectura.

Criterio de cierre: las recepciones habituales requieren revisar solo excepciones.

Estado: completada el 2026-09-28. El sistema memoriza clasificaciones luego de una confirmacion real, aprende los formatos documentales por proveedor, mide decisiones y correcciones, alerta variaciones de costo desde el 10% y posibles duplicados, y propone reglas pendientes sin activarlas. Las coincidencias exactas por codigo o EAN pueden deshacerse antes de confirmar. Atenea puede explicar el estado, costos, documentos, alertas, precios y responsable de una recepcion sin modificarla.

### Fase 8 - Cierre operativo

Objetivo: permitir resolver errores y decisiones habituales sin salir del modulo ni alterar operaciones confirmadas.

- [x] Anular borradores con motivo, usuario, fecha y auditoria.
- [x] Impedir la anulacion directa de recepciones confirmadas.
- [x] Quitar lineas de borradores y recalcular cabecera, metricas y conciliacion.
- [x] Desvincular documentos equivocados y permitir volver a cargarlos.
- [x] Clasificar varias lineas juntas por rubro, categoria, subtipo y marca.
- [x] Aprobar o descartar reglas sugeridas con historial de resolucion.
- [x] Reutilizar reglas aprobadas como sugerencias revisables en recepciones futuras.
- [x] Bloquear edicion, eliminacion y calculos sobre recepciones anuladas.

Criterio de cierre: un operador puede corregir o abandonar un borrador desde la pantalla, mientras que una recepcion confirmada conserva su trazabilidad y exige un flujo de correccion explicito.

Estado: completada el 2026-09-29. Las acciones destructivas se limitan a borradores; las recepciones confirmadas no se eliminan ni anulan porque ya afectaron stock, costos y precios. Toda anulacion, eliminacion, clasificacion masiva y decision de aprendizaje queda auditada.

## Caso inicial de validacion

Lista de 14 lineas con codigos de proveedor, descripcion, cantidad y costo final unitario.

Resultado observado al 2026-09-27:

- 1 codigo coincide con un producto existente: `483006243`.
- 13 codigos requieren alta o vinculacion.

Este caso debe utilizarse como prueba de aceptacion de las Fases 1 y 2.

## Pruebas obligatorias

- Importacion correcta de numeros con formato argentino.
- Deteccion de codigos duplicados dentro del mismo archivo.
- Deteccion de documento previamente procesado.
- Coincidencia exacta por proveedor y codigo.
- Bloqueo de coincidencias ambiguas.
- Alta de producto nuevo con datos obligatorios.
- Prorrateo exacto de descuento general.
- Aplicacion parcial y total de nota de credito.
- Conciliacion con diferencia cero.
- Rollback completo ante una falla intermedia.
- Confirmacion idempotente ante doble clic o reintento.
- Actualizacion correcta de costo promedio y stock.
- Vista previa de precios sin modificarlos antes de confirmar.

## Fuera de alcance inicial

- Emitir comprobantes fiscales ante ARCA.
- Pagar facturas al proveedor.
- Confirmar automaticamente recepciones sin intervencion humana.
- Eliminar productos existentes durante una importacion.

## Registro de decisiones

| Fecha | Decision | Motivo |
| --- | --- | --- |
| 2026-09-27 | La IA prepara borradores, pero no confirma operaciones. | Evitar impactos silenciosos sobre costos, catalogo y stock. |
| 2026-09-27 | La primera entrega acepta tablas estructuradas antes de leer PDF. | Obtener valor operativo temprano y validar el flujo completo. |
| 2026-09-27 | La confirmacion sera transaccional e idempotente. | Evitar ingresos parciales o duplicados. |
| 2026-09-27 | Los PDF y Excel legibles generan el mismo borrador seguro de las tablas pegadas. | Reutilizar conciliacion, revision y confirmacion sin abrir un flujo paralelo. |
| 2026-09-27 | Las imagenes se conservan como pendientes de OCR y nunca generan productos inventados. | Mantener trazabilidad hasta incorporar un lector confiable. |
| 2026-09-28 | La Fase 5 se cierra con OCR local, confianza por campo y correccion humana dentro del borrador. | Permitir procesar formatos excepcionales sin depender de una IA externa ni relajar controles de stock. |
| 2026-09-28 | Los precios se calculan sobre el costo promedio proyectado despues del ingreso. | Evitar que stock anterior y costo nuevo produzcan sugerencias comerciales irreales. |
| 2026-09-28 | Una vista previa puede usar reglas, conservar margen o mantener precios; aplicar sigue dependiendo de la confirmacion final. | Automatizar sin quitar control al operador. |
| 2026-09-28 | Codigo de proveedor y EAN pueden resolver automaticamente; descripcion similar solo sugiere y toda coincidencia automatica se puede deshacer. | Reducir trabajo repetido sin convertir una semejanza en una vinculacion silenciosa. |
| 2026-09-28 | Las bajas de costo nunca reducen precios automaticamente y las variaciones desde 10% generan alerta. | Proteger margen y obligar a revisar cambios comerciales sensibles. |
| 2026-09-28 | Las reglas detectadas por repeticion quedan pendientes hasta aprobacion humana. | Hacer que el sistema aprenda sin otorgarle capacidad de cambiar criterios por su cuenta. |
| 2026-09-29 | Los borradores pueden anularse, pero las recepciones confirmadas requieren una correccion de inventario explicita. | Preservar la trazabilidad de stock, costos y precios ya aplicados. |
| 2026-09-29 | Quitar una linea invalida la conciliacion y obliga a recalcularla. | Evitar que un total viejo sobreviva a un cambio en los productos. |
| 2026-09-29 | Aprobar una regla la habilita como sugerencia, nunca como vinculacion automatica por descripcion. | Aprovechar el aprendizaje sin confundir productos parecidos. |

## Trabajo restante

1. Fase 0 pendiente: cerrar tratamiento de IVA, notas de credito, flete, percepciones, prorrateo y redondeo contable oficial.
2. Piloto operativo pendiente: procesar documentos reales de cada proveedor y ajustar formatos o umbrales con evidencia.
3. Fuera de alcance actual: integracion fiscal con ARCA y pago de facturas a proveedores.

## Proximo paso

Probar la Fase 7 con recepciones reales de cada proveedor y ajustar umbrales solo con evidencia. Antes de automatizar el tratamiento impositivo o fiscal, cerrar las decisiones contables pendientes de la Fase 0.
