# CRM operativo y analisis de clientes

## Estado del documento

- Estado general: en implementacion
- Fase activa: ninguna; plan CRM de Fases 0 a 6 completado
- Ultima actualizacion: 2026-10-27
- Objetivo: convertir la ficha de cliente existente en una herramienta que explique la relacion comercial y permita organizar seguimientos concretos.

Este documento es la fuente de verdad para implementar el CRM y el analisis de clientes por fases. Se debe actualizar al comenzar y terminar cada fase, al cambiar una regla comercial, al descubrir una excepcion y al modificar una formula.

## Protocolo para retomar el trabajo

Antes de continuar una fase:

1. Leer este documento completo.
2. Revisar `Estado del documento`, `Registro de fases` y `Registro de decisiones`.
3. Comparar lo documentado con el codigo y las migraciones actuales.
4. Revisar `git status` y conservar cambios ajenos o pendientes.
5. Implementar solo el alcance de la fase activa.
6. Ejecutar las pruebas indicadas para esa fase.
7. Actualizar este documento antes de dar la fase por terminada.

No se debe considerar terminada una fase solamente porque la interfaz exista. Los calculos, permisos, estados vacios, comportamiento movil y conciliaciones deben quedar verificados.

## Problema a resolver

La ficha actual permite consultar datos y movimientos de un cliente, pero obliga al operador a interpretar manualmente toda la historia para responder preguntas simples:

- Cuando fue la ultima vez que compro o llevo una bicicleta al taller.
- Si compra con frecuencia o dejo de volver.
- Cuanto compro en un periodo y que ganancia comercial aporto.
- Que rubros, productos o servicios consume habitualmente.
- Como se comporta con sus pagos.
- Que bicicletas tiene y cuando podria necesitar otro servicio.
- Si existe alguna accion pendiente con ese cliente.
- A quien conviene contactar hoy y por que.

Un listado de movimientos no es por si solo un CRM. El sistema debe combinar:

1. **Analisis:** transformar operaciones reales en indicadores explicables.
2. **Contexto:** mostrar la historia comercial, financiera y de taller.
3. **Accion:** registrar que hay que hacer, cuando y quien es responsable.
4. **Seguimiento:** conservar el resultado de cada contacto sin perder trazabilidad.

## Resultado esperado

Desde la ficha de un cliente, el operador debe poder entender en pocos segundos:

- Estado actual de la relacion.
- Ultima actividad y tiempo transcurrido.
- Actividad de los ultimos 30, 90 y 365 dias.
- Ventas, ticket promedio y frecuencia.
- Ganancia comercial y calidad de los costos utilizados.
- Rubros y productos mas relevantes.
- Actividad de taller y bicicletas registradas.
- Deudas y creditos vigentes.
- Proxima accion pendiente.

Desde un panel general debe poder encontrar segmentos accionables, por ejemplo clientes recientes, frecuentes, inactivos, con deuda, con credito, mayoristas o con seguimiento vencido.

## Principios de diseno

- El CRM debe estar adaptado a la bicicleteria, no copiar un CRM generico.
- Cada indicador debe poder explicarse con operaciones reales del sistema.
- No se usara una puntuacion opaca como unico criterio de clasificacion.
- Las etiquetas automaticas deben mostrar la regla que las genero.
- Analisis comercial, cobranza y caja son conceptos distintos.
- Una venta no cobrada puede aportar margen comercial esperado, pero no ingreso de caja.
- Un cobro actual puede corresponder a una venta de un periodo anterior.
- La ganancia por cliente debe usar costos congelados de la venta y la misma logica oficial de rentabilidad.
- Los servicios con costo directo cero no equivalen a mercaderia sin costo cargado.
- Los datos historicos incompletos deben generar una advertencia, no una precision inventada.
- Atenea puede explicar y sugerir; no debe contactar clientes ni cerrar tareas automaticamente.
- La pantalla debe mostrar primero lo accionable y dejar el detalle en pestanas o secciones desplegables.
- Los calculos del backend son la fuente oficial; el frontend no debe reconstruir formulas contables.

## Situacion actual verificada

La ficha de cliente ya concentra:

- Datos personales, fiscales y tipo de cliente.
- Ventas recientes.
- Pagos.
- Deudas abiertas y canceladas.
- Creditos disponibles y aplicados.
- Reservas.
- Ordenes de taller.
- Bicicletas registradas.
- Historial combinado de movimientos.
- Estado de cuenta y una accion recomendada basica.

Archivos principales actuales:

- `frontend/src/pages/ClienteDetallePage.jsx`
- `frontend/src/pages/ClientesListPage.jsx`
- `frontend/src/services/clientesService.js`
- `app/modules/clientes/routes.py`
- `app/modules/clientes/service.py`
- `app/modules/clientes/repository.py`
- `tests/test_clientes.py`

El resumen actual calcula cantidad de ventas, total comprado, saldo pendiente y ultima venta para estados `entregada` y `pagada_parcial`. Todavia no ofrece:

- Periodos comparables.
- Ticket promedio.
- Frecuencia o dias de inactividad.
- Ganancia comercial por cliente.
- Composicion por rubro.
- Evolucion temporal.
- Segmentos automaticos explicables.
- Seguimientos, responsables o vencimientos.
- Resultado de contactos.
- Un panel CRM general.

El sistema ya conserva `venta_items.costo_unitario_aplicado` y dispone de una fuente oficial de rentabilidad. El CRM debe reutilizar esa logica y no crear una segunda definicion de ganancia.

## Glosario y formulas

### Operacion comercial valida

Se deben usar los mismos estados comerciales aceptados por el modulo de rentabilidad. No se deben incluir ventas anuladas como compras del cliente. Las devoluciones deben reducir cantidades, ventas y costos segun la fuente oficial.

La lista exacta de estados no se duplicara en el CRM: debe provenir de una constante o consulta compartida.

### Ventas comerciales netas

Importe comercial neto de operaciones validas del periodo, luego de devoluciones y beneficios que reduzcan la venta. No representa necesariamente dinero cobrado.

### Costo de mercaderia vendida

Suma del costo unitario aplicado y congelado por la cantidad neta vendida. Las devoluciones deben revertir el costo correspondiente.

### Ganancia comercial

```text
ventas comerciales netas
- costo de mercaderia vendida
= ganancia comercial
```

Para taller, los servicios sin costo directo pueden tener margen comercial antes de gastos operativos. Los repuestos sin costo cargado deben marcarse como dato incompleto.

### Margen comercial porcentual

```text
ganancia comercial / ventas comerciales netas * 100
```

Si las ventas netas son cero, el porcentaje se presenta como no calculable.

### Ticket promedio

```text
ventas comerciales netas / cantidad de operaciones comerciales validas
```

Una venta cuenta una sola vez aunque tenga varios items o pagos.

### Frecuencia

La frecuencia se calcula con fechas de operaciones comerciales validas. Deben mostrarse:

- Cantidad de operaciones en 30, 90 y 365 dias.
- Dias desde la ultima actividad.
- Promedio de dias entre operaciones cuando existan al menos dos.

La actividad de taller debe exponerse ademas como indicador propio para no ocultar clientes que vuelven al taller aunque no realicen ventas minoristas comunes.

### Cobranza

Se mostrara separada de las ventas:

- Dinero efectivamente cobrado.
- Credito a favor aplicado.
- Beneficios o descuentos aplicados.
- Saldo pendiente.

No se llamara compra nueva a un cobro de una venta anterior ni ingreso de caja a la aplicacion de credito a favor.

### Ganancia aportada por el cliente

En la primera version significa ganancia comercial de sus ventas validas, no resultado distribuible ni efectivo disponible para retirar. Resultado financiero, gastos operativos y momento de cobranza quedan fuera de esa cifra salvo que se presenten por separado.

### Calidad del dato

El analisis debe informar al menos:

- Cantidad de items con costo valido.
- Cantidad de servicios con costo directo cero.
- Cantidad de mercaderias sin costo confiable.
- Si el total del desglose por rubro concilia con el resumen.

Si existen costos faltantes, la ganancia se muestra como estimada y con advertencia visible.

## Periodos de analisis

La ficha ofrecera inicialmente:

- Ultimos 30 dias.
- Ultimos 90 dias.
- Ultimos 365 dias.
- Historico completo.
- Periodo personalizado en una fase posterior.

El periodo por defecto sera 365 dias. Los indicadores financieros de deuda y credito siempre mostraran el saldo vigente, aunque el analisis comercial use otro periodo.

## Diseno funcional de la ficha

Se agregara una pestana `Analisis` a la ficha existente. No se sobrecargara la pestana `Resumen`.

### Cabecera del analisis

Indicadores prioritarios:

- Ultima actividad y dias transcurridos.
- Ventas netas del periodo.
- Ganancia comercial.
- Ticket promedio.
- Cantidad de operaciones.
- Deuda o credito vigente, cuando corresponda.

### Comportamiento comercial

- Evolucion mensual de ventas y ganancia.
- Cantidad de operaciones por mes.
- Frecuencia promedio.
- Comparacion con el periodo anterior equivalente.

### Preferencias y composicion

- Ventas, costo, ganancia y cantidad por rubro.
- Productos o servicios mas comprados.
- Participacion de taller frente a venta de mercaderia.
- Bicicletas relacionadas y actividad de cada una.

### Lectura operativa

El sistema debe producir una explicacion breve basada exclusivamente en los indicadores. Ejemplo de estructura:

```text
Realizo 4 operaciones en los ultimos 12 meses por $X.
La mayor actividad fue en Taller y Repuestos.
Su ultima visita fue hace 47 dias y no posee deuda abierta.
```

No se deben inventar motivos para una caida o aumento de actividad.

### Proxima accion

Cuando exista un seguimiento manual pendiente, este tiene prioridad. Si no existe, el sistema puede sugerir una accion explicable, por ejemplo:

- Revisar deuda abierta.
- Aplicar credito disponible.
- Contactar por seguimiento vencido.
- Recordar service segun historial real.
- Completar telefono o datos indispensables.

La sugerencia nunca se marca automaticamente como realizada.

## Segmentos explicables

Los segmentos iniciales seran etiquetas independientes; un cliente puede pertenecer a varias.

- `nuevo`: primera operacion dentro del umbral configurado.
- `recurrente`: supera la cantidad minima de operaciones en el periodo configurado.
- `frecuente_taller`: actividad reiterada de taller.
- `mayorista`: tipo de cliente mayorista.
- `inactivo`: supero el umbral de dias sin actividad despues de haber tenido operaciones.
- `con_deuda`: posee saldo de deuda vigente mayor que cero.
- `con_credito`: posee credito disponible mayor que cero.
- `seguimiento_vencido`: posee una tarea pendiente con fecha vencida.
- `alto_valor`: pertenece al tramo superior de actividad comercial del negocio dentro de un periodo, no a un importe fijo arbitrario.
- `actividad_en_caida`: el periodo reciente tiene menor actividad que el periodo anterior equivalente, con una base minima suficiente.

Los umbrales se centralizaran y quedaran documentados. Durante la Fase 0 se validaran con datos reales antes de fijarlos.

## Modelo de seguimiento CRM

Una tarea de seguimiento necesita como minimo:

- Cliente.
- Tipo: llamada, WhatsApp, service, presupuesto, reserva, deuda, postventa u otro.
- Motivo visible.
- Fecha objetivo.
- Responsable.
- Estado: pendiente, realizada o cancelada.
- Prioridad.
- Fecha de creacion y usuario creador.
- Fecha de resolucion y usuario que resolvio.
- Resultado o nota de cierre.
- Referencia opcional a venta, deuda, reserva, orden de taller o bicicleta.

Reglas:

- Las tareas se cierran, no se borran.
- Reprogramar conserva la fecha anterior en auditoria.
- Una sugerencia automatica no crea una tarea sin confirmacion humana.
- Los contactos y resultados forman parte del historial del cliente.
- Las notas internas no deben aparecer en documentos para el cliente.

## Panel CRM general

La pagina general debe servir como bandeja de trabajo y no como tablero decorativo.

Filtros previstos:

- Buscar por nombre, telefono, DNI, CUIT o bicicleta.
- Segmento.
- Ultima actividad.
- Con deuda o con credito.
- Tipo de cliente.
- Rubro principal.
- Con seguimiento pendiente o vencido.
- Responsable.

Vistas prioritarias:

- Para atender hoy.
- Seguimientos vencidos.
- Clientes recientes.
- Clientes inactivos.
- Clientes frecuentes.
- Con deuda.
- Con credito disponible.

Cada fila debe mostrar nombre, telefono, ultima actividad, segmento principal, estado financiero, proxima accion y responsable. El detalle analitico queda dentro de la ficha.

## Arquitectura propuesta

### Fuente de calculo

Crear una unica capa de calculo reutilizable para analisis individual, listado CRM y futuras explicaciones de Atenea.

Endpoint individual propuesto:

```text
GET /clientes/{cliente_id}/analisis?periodo=365d
```

La respuesta debe incluir:

- Periodo y periodo comparativo.
- Resumen comercial.
- Cobranza y saldos vigentes.
- Calidad de datos.
- Desglose mensual.
- Desglose por rubro.
- Productos y servicios principales.
- Indicadores de taller.
- Segmentos con regla explicativa.
- Proxima accion manual o sugerida.

Para el panel general se debe evitar ejecutar una consulta completa por cada cliente. Se necesitara una consulta agregada o una vista materializable segun el volumen medido.

### Persistencia nueva prevista

El analisis calculado no requiere guardarse inicialmente. Los seguimientos si requieren tablas nuevas:

- `cliente_seguimientos`
- `cliente_seguimiento_eventos`

Las etiquetas automaticas se calculan. Las etiquetas manuales, si se incorporan, deben almacenarse por separado con usuario y fecha.

### Permisos

- Consultar datos generales del cliente conserva el permiso actual de clientes.
- Ver ganancia y margen requiere el permiso oficial de rentabilidad.
- Un usuario sin ese permiso puede ver actividad, ventas y seguimientos, pero no costos ni ganancia.
- Crear o resolver seguimientos requiere un permiso CRM especifico o uno operativo equivalente definido en la fase correspondiente.
- Atenea debe respetar los mismos permisos que la pantalla.

## Fases de implementacion

### Fase 0 - Definiciones y auditoria de datos

Estado: completada el 2026-10-26.

Objetivo: cerrar las formulas y medir la calidad de los datos antes de disenar indicadores definitivos.

Tareas:

- Reutilizar o extraer la fuente oficial de rentabilidad por venta e item.
- Confirmar estados comerciales y tratamiento de devoluciones.
- Auditar costos faltantes y servicios con costo cero.
- Medir cantidad de clientes con telefono, ventas, taller y bicicletas.
- Medir distribucion real de frecuencia, ticket e inactividad.
- Proponer umbrales iniciales de segmentos con evidencia.
- Validar permisos para datos de ganancia.
- Preparar ejemplos reales de aceptacion.

Cierre:

- Las formulas quedan documentadas y conciliadas.
- Los umbrales iniciales quedan aprobados.
- Se conocen las limitaciones de los datos historicos.

Resultado verificado:

- 375 clientes operativos, todos con telefono cargado.
- 360 clientes con al menos una compra valida.
- La mediana es 1 operacion; el percentil 75 es 2 y el percentil 90 es 3.
- Los dias sin compra tienen mediana 52, percentil 75 de 77 y percentil 90 de 98.
- 196 clientes poseen historial de taller; el percentil 90 alcanza 2 ordenes.
- Se adopta una primera regla prudente: nuevo hasta 30 dias, recurrente desde 2 operaciones, frecuente de taller desde 2 ordenes e inactivo desde 90 dias.
- La ganancia reutiliza el detalle oficial de Rentabilidad, con devoluciones y costos congelados.

### Fase 1 - Analisis individual de solo lectura

Estado: completada el 2026-10-26.

Objetivo: agregar la pestana `Analisis` sin modificar operaciones ni crear tareas.

Tareas:

- Implementar servicio y endpoint de analisis.
- Agregar selector de periodo.
- Mostrar indicadores, evolucion, rubros y productos principales.
- Mostrar calidad de datos y advertencias.
- Incorporar segmentos automaticos explicables.
- Implementar estados de carga, sin datos, error y vista movil.
- Ocultar costos y ganancia segun permisos.

Cierre:

- Totales conciliados con ventas y rentabilidad.
- Respuesta eficiente para un cliente con historial amplio.
- Pantalla validada en escritorio y celular.

Resultado implementado:

- Endpoint `GET /clientes/{cliente_id}/analisis` con periodos de 30, 90 y 365 dias e historico.
- Resumen de ventas, operaciones, ticket, costo, ganancia y margen.
- Comparacion contra el periodo anterior equivalente cuando corresponde.
- Ultima actividad, frecuencia de compra, ordenes de taller y bicicletas registradas.
- Evolucion mensual, rubros y productos principales.
- Deuda y credito vigentes sin confundirlos con ventas o caja.
- Segmentos explicables y lectura operativa automatica.
- Control de conciliacion y advertencias de costos.
- Ocultamiento de costos y ganancia sin permiso `ver_rentabilidad`.
- Vista validada sin desborde horizontal en 1440 px y 390 px.
- 50 pruebas de clientes, rentabilidad y contrato frontend aprobadas.

### Fase 2 - Panel general de clientes

Estado: completada el 2026-10-26.

Objetivo: encontrar grupos accionables sin abrir clientes uno por uno.

Tareas:

- Crear vista CRM general.
- Agregar filtros y vistas guardadas basicas.
- Mostrar ultima actividad, segmentos y estado financiero.
- Permitir ordenar por reciente, inactividad, actividad y valor.
- Agregar exportacion operativa cuando el filtro lo justifique.
- Verificar rendimiento y paginacion.

Cierre:

- Los resultados coinciden con el analisis individual.
- Los filtros combinados son reproducibles.
- No existe una consulta por cliente que degrade el listado.

Resultado implementado:

- Pagina `CRM clientes` accesible desde Operacion y desde el listado administrativo.
- Endpoint `GET /clientes/crm/panel` con busqueda, vistas, filtros, orden y paginacion.
- Vistas para nuevos, recurrentes, inactivos, deuda, credito, taller, alto valor y sin actividad.
- Busqueda por nombre, telefono, DNI, CUIT, razon social y datos de bicicletas.
- Resumen de ultima actividad, operaciones, ventas, ganancia autorizada, rubro principal, segmentos y cuenta corriente.
- Accion sugerida explicable sin crear tareas ni modificar datos.
- Exportacion CSV de hasta 500 clientes respetando los filtros activos.
- Alto valor definido dinamicamente como el 25% superior por ventas de los ultimos 365 dias.
- Una consulta comercial y una consulta de contexto para todo el panel, sin consultas por cliente.
- Respuesta verificada sobre 375 clientes operativos en aproximadamente 0,17 segundos.
- Paginacion adaptada: 50 filas en escritorio y 15 fichas en celular.
- Vista validada sin desborde horizontal en 1440 px y 390 px.
- 52 pruebas de clientes, rentabilidad y contrato frontend aprobadas.

### Fase 3 - Seguimientos y agenda

Estado: completada el 2026-10-27.

Objetivo: transformar el analisis en trabajo organizado.

Tareas:

- Crear migraciones, repositorio, servicio y endpoints.
- Crear, reprogramar, realizar y cancelar seguimientos.
- Mostrar proxima accion en ficha y listado.
- Crear bandejas `Hoy`, `Vencidos` y `Proximos`.
- Incorporar eventos al historial del cliente.
- Auditar usuario, fechas y cambios.

Cierre:

- Ninguna tarea se pierde ni se borra fisicamente.
- Responsables y permisos quedan validados.
- El historial explica cada cambio de estado.

Resultado implementado:

- Tablas `cliente_seguimientos` y `cliente_seguimiento_eventos` con referencias, responsables y auditoria inmutable.
- Permiso `gestionar_crm` asignado a administrador, encargado y operador.
- Creacion de tareas desde la ficha del cliente con tipo, motivo, fecha, prioridad y responsable.
- Reprogramacion con conservacion de fecha, prioridad y responsable anteriores.
- Cierre como realizada o cancelada con resultado obligatorio; no existe borrado fisico.
- Bandejas generales `Vencidos`, `Hoy`, `Proximos`, `Todos pendientes` y `Cerrados`.
- Busqueda por cliente, telefono, motivo o responsable y filtro por responsable.
- Acceso rapido `Mis tareas` para el usuario actual.
- La proxima tarea manual tiene prioridad sobre sugerencias automaticas en el panel CRM.
- Segmento explicable `seguimiento_vencido` cuando la fecha objetivo ya paso.
- Historial de cada tarea visible y eventos incorporados al historial general del cliente.
- Pantalla general separada en modos `Clientes` y `Seguimientos` para evitar una pagina interminable.
- Formulario y agenda verificados sin desborde horizontal en 1440 px y 390 px.
- 55 pruebas de clientes, CRM, rentabilidad y contrato frontend aprobadas al cierre de la fase 4.

### Fase 4 - Oportunidades de taller y postventa

Estado: completada el 2026-10-27.

Objetivo: usar bicicletas e historial tecnico para generar oportunidades verificables.

Tareas:

- Detectar services pendientes solo cuando exista una regla real de fecha o uso.
- Relacionar presupuestos, reservas y postventa sin cerrar.
- Sugerir seguimiento por bicicleta y motivo.
- Evitar duplicar una tarea manual ya existente.

Resultado implementado:

- Panel `Oportunidades` dentro del CRM y bloque contextual dentro de la ficha del cliente.
- Services sugeridos solo para bicicletas con plan `service_30_dias`, fecha limite real y service sin usar.
- Presupuestos sugeridos solo cuando estan enviados o aceptados y todavia no fueron convertidos.
- Reservas sugeridas solo cuando siguen activas y vencen dentro de tres dias o ya vencieron.
- Casos de postventa sugeridos mientras no esten cerrados ni cancelados.
- Evidencia visible con fecha, estado, identificador y datos del origen disponibles.
- Una oportunidad desaparece cuando ya existe un seguimiento pendiente para su referencia principal.
- Confirmacion en dos pasos con responsable, fecha y prioridad; nunca se crea una tarea automaticamente.
- Acceso directo al service, presupuesto, reserva o caso de postventa que origino la señal.
- Paginacion de diez casos para mantener la revision utilizable en escritorio y celular.
- Auditoria operativa: 82 señales verificables al cierre, compuestas por 81 services y 1 presupuesto.
- Validacion responsive sin desborde horizontal en 1440 px y 390 px.
- 55 pruebas de clientes, CRM, rentabilidad y contrato frontend aprobadas, mas 2 pruebas visuales.

Cierre:

- Cada oportunidad muestra la evidencia que la origino.
- No se generan recordatorios inventados por falta de datos.

### Fase 5 - Atenea como asistente CRM

Estado: completada el 2026-10-27.

Objetivo: explicar la relacion y ayudar a preparar acciones.

Tareas:

- Responder preguntas sobre actividad, rubros y saldos respetando permisos.
- Explicar por que un cliente pertenece a un segmento.
- Proponer una tarea o borrador de mensaje.
- Exigir confirmacion para crear tareas o usar un mensaje.
- Citar las operaciones utilizadas en la explicacion.

Cierre:

- Atenea no inventa causas ni numeros.
- Las respuestas coinciden con el endpoint oficial.
- Ninguna accion externa se ejecuta automaticamente.

Resultado implementado:

- Atenea detecta automaticamente el cliente cuando se abre desde su ficha y tambien puede resolver una coincidencia unica por nombre o por `cliente #ID`.
- Las respuestas reutilizan `obtener_analisis_cliente_service`; no existe una segunda formula de ventas, costos, ganancia, rubros o segmentos.
- La lectura incluye ventas netas, operaciones, deuda, credito, rubros principales y los motivos exactos de cada segmento.
- Ganancia y margen solo aparecen cuando el usuario posee `ver_rentabilidad`.
- Se citan la ficha, el analisis oficial y hasta tres ventas concretas del periodo como referencias navegables.
- Atenea puede preparar un borrador de mensaje, pero nunca lo envia; copiarlo requiere un clic explicito.
- Puede proponer revisar y crear un seguimiento, pero la creacion conserva la confirmacion de responsable, fecha y prioridad de la Fase 3.
- Las consultas generales conservan su alcance aunque Atenea este abierta sobre la ficha de un cliente.
- Panel renombrado como `Atenea`, con contexto del cliente, referencias y acciones diferenciadas visualmente.
- Validacion responsive aprobada en 1440 px y 390 px sin desborde horizontal.
- 65 pruebas de asistente, clientes, CRM, rentabilidad y contrato frontend aprobadas, mas 2 pruebas visuales.

### Fase 6 - Comunicaciones y medicion

Estado: completada el 2026-10-27.

Objetivo: preparar listas y medir resultados sin convertir el sistema en una plataforma de spam.

Tareas posibles:

- Borradores de WhatsApp por segmento.
- Registro manual o integrado del contacto.
- Resultado de campanas y conversion posterior.
- Preferencias de contacto y exclusion.

Resultado implementado:

- Bandeja `Comunicaciones` dentro del CRM con listas por clientes inactivos, nuevos, recurrentes, taller, credito, deuda y alto valor.
- Borradores individuales explicables segun el segmento; copiar el texto requiere accion manual y nunca abre ni envia WhatsApp automaticamente.
- Los borradores usan lenguaje humano y no exponen dias de inactividad, nombres de segmentos ni estados internos del CRM.
- El primer mensaje abre una conversacion en nombre de Ale, sin ofrecer productos o servicios; solo menciona la bicicleta cuando existe una registrada y solo usa el reencuentro cuando hay inactividad real.
- Registro de canal, resultado, mensaje utilizado, nota, operador y fecha de cada contacto.
- Resultados medibles: contactado, sin respuesta, respondio, interesado, no interesado, convertido u otro.
- Resumen de los ultimos 30 dias con contactos, respuestas, interesados, conversiones, clientes unicos y tasa de respuesta.
- Preferencia persistente `no contactar`, con motivo obligatorio y bloqueo backend de nuevos contactos.
- Las exclusiones permanecen visibles en la lista para evitar contactos accidentales y pueden rehabilitarse manualmente.
- Historial de contactos incorporado a la ficha individual del cliente.
- Paginacion de diez clientes y validacion responsive en 1440 px y 390 px.
- Migracion aplicada en bases de prueba y operativa.
- 67 pruebas de asistente, clientes, CRM, rentabilidad y contrato frontend aprobadas, mas 2 pruebas visuales de la fase.

## Estrategia de pruebas

### Calculos

- Venta valida con un item y costo conocido.
- Venta con varios rubros.
- Venta parcialmente pagada.
- Cobro de una venta anterior.
- Credito aplicado sin ingreso nuevo de caja.
- Devolucion parcial y total.
- Venta anulada.
- Servicio con costo directo cero.
- Mercaderia sin costo confiable.
- Cliente sin ventas.
- Cliente con una sola operacion.
- Cliente con varias operaciones el mismo dia.

### Conciliaciones

- Suma por rubro igual al resumen comercial.
- Venta neta menos costo igual a ganancia comercial.
- Cantidad de operaciones sin duplicacion por items o pagos.
- Deuda y credito iguales a sus modulos de origen.
- Segmentos iguales entre ficha y panel general.

### Interfaz

- Escritorio y celular.
- Textos extensos sin superposicion.
- Usuario con y sin permiso de rentabilidad.
- Carga, error, sin actividad y datos incompletos.
- Navegacion desde un segmento hasta las operaciones que lo explican.

## Casos de aceptacion iniciales

Antes de cerrar la Fase 1 se elegiran al menos:

- Un cliente frecuente de taller.
- Un cliente con varias ventas y pagos parciales.
- Un cliente con deuda.
- Un cliente con credito aplicado.
- Un mayorista.
- Un cliente inactivo.
- Un cliente con devolucion o venta anulada.
- Un cliente con costo faltante en alguna mercaderia.

Para cada caso se calcularan manualmente ventas, costos, ganancia, cantidad de operaciones y ultima actividad, y se compararan con el endpoint.

## Fuera de alcance inicial

- Envio automatico de WhatsApp o correo.
- Campanas masivas automaticas.
- Predicciones de compra sin volumen de datos validado.
- Puntajes de cliente no explicables.
- Modificar precios o limites de credito desde el CRM.
- Reemplazar los modulos de ventas, caja, taller, deudas o rentabilidad.
- Guardar copias de indicadores que puedan quedar desactualizadas sin una necesidad de rendimiento demostrada.

## Decisiones pendientes

- [x] Umbral inicial para considerar un cliente nuevo: primera compra dentro de 30 dias.
- [x] Umbral inicial de inactividad: 90 dias sin venta ni orden de taller.
- [x] Regla inicial de recurrente: 2 operaciones en el periodo seleccionado; por defecto, 365 dias.
- [x] Regla inicial de cliente frecuente de taller: 2 ordenes en el periodo seleccionado.
- [x] Definicion estadistica de alto valor: 25% superior por ventas comerciales netas de los ultimos 365 dias, recalculado sobre clientes con ventas positivas.
- [x] En Fase 1, la ultima actividad incluye ventas y ordenes de taller; los contactos se agregaran con Seguimientos.
- [ ] Si se necesitan etiquetas manuales ademas de las automaticas.
- [x] Permiso para crear y resolver seguimientos: `gestionar_crm`, otorgado a administrador, encargado y operador.
- [x] Responsable por defecto: el usuario actual; puede reasignarse a cualquier usuario activo.
- [ ] Preferencias y consentimiento de contacto que deben registrarse.

## Registro de decisiones

### 2026-10-26 - CRM especifico del negocio

- Se define que el objetivo no es instalar un CRM generico, sino extender la ficha de cliente existente.
- El analisis y el seguimiento se implementaran por separado.
- La primera entrega sera de solo lectura y reutilizara datos actuales.
- La ganancia por cliente reutilizara la fuente oficial de rentabilidad.
- Las tareas y comunicaciones automaticas quedan para fases posteriores.

### 2026-10-26 - Cierre de analisis individual

- Se completan la auditoria inicial y la Fase 1.
- Se adoptan umbrales iniciales basados en la distribucion real de clientes.
- La pantalla de analisis vive en una pestana independiente para no sobrecargar el resumen.
- El endpoint comparte la clasificacion y conciliacion oficial de Rentabilidad.
- Las fechas del CRM se calculan con el dia operativo de Argentina y se muestran sin conversion UTC.

### 2026-10-26 - Cierre del panel general

- El panel reutiliza la misma fuente de rentabilidad y las mismas reglas de segmentos del analisis individual.
- Los filtros se calculan en backend y se pueden combinar sin alterar los datos de clientes.
- Se evita el patron de una consulta por cliente: el contexto y la actividad comercial se obtienen en dos consultas globales.
- Alto valor queda como un umbral estadistico dinamico y no como un importe fijo arbitrario.
- La exportacion CSV es operativa; no expone ganancia cuando el usuario carece del permiso correspondiente.

### 2026-10-27 - Cierre de seguimientos y agenda

- Las tareas CRM son operaciones internas auditables y nunca se eliminan fisicamente.
- Crear, reprogramar y cerrar requiere el permiso `gestionar_crm`.
- El usuario actual queda como responsable inicial, con reasignacion explicita a usuarios activos.
- Una tarea manual pendiente reemplaza a la sugerencia automatica como proxima accion del cliente.
- Los cambios se registran en el historial propio de la tarea y en el historial general del cliente.
- Las comunicaciones continúan siendo manuales: crear una tarea no envia WhatsApp, correo ni avisos externos.

### 2026-10-27 - Cierre de oportunidades verificables

- Una señal CRM debe tener una fuente operativa concreta; no se infieren fechas de service cuando la bicicleta no tiene plan y vencimiento registrados.
- Cada seguimiento automatico conserva una sola referencia principal para evitar asociaciones ambiguas.
- Las oportunidades no envian mensajes ni crean tareas por si solas: el operador confirma responsable, fecha y prioridad.
- La deteccion excluye tareas pendientes ya existentes y ordenes de service abiertas para la misma bicicleta.
- El volumen real de services pendientes se presenta paginado, conservando los totales generales como contexto.

### 2026-10-27 - Cierre de Atenea CRM

- Atenea funciona como una capa explicativa deterministica sobre los servicios oficiales; no recalcula ni completa datos faltantes por inferencia.
- Las respuestas respetan permisos de rentabilidad y mantienen separadas las consultas generales de las consultas sobre el cliente abierto.
- Los segmentos siempre se muestran junto con la regla que los origino.
- Los borradores de mensajes y propuestas de seguimiento son preparatorios: no envian comunicaciones ni crean tareas automaticamente.
- Las referencias navegables permiten volver a la ficha, al analisis y a las ventas concretas usadas como respaldo.

### 2026-10-27 - Cierre de comunicaciones y medicion

- El CRM prepara contactos individuales; no existe envio masivo ni automatico.
- Una conversion se cuenta solo cuando un operador la registra explicitamente como resultado del contacto.
- Copiar un borrador no se interpreta como mensaje enviado, entregado ni leido.
- La preferencia `no contactar` requiere motivo, queda auditada con usuario y fecha, y bloquea registros posteriores hasta su rehabilitacion.
- Las metricas usan comunicaciones registradas durante los ultimos 30 dias y no infieren respuestas desde ventas posteriores.
- Los dias sin actividad sirven para seleccionar la lista interna, pero nunca se incluyen en el mensaje dirigido al cliente.

## Registro de fases

| Fase | Estado | Inicio | Cierre | Resultado |
| --- | --- | --- | --- | --- |
| 0. Definiciones y auditoria | Completada | 2026-10-26 | 2026-10-26 | Fuentes conciliadas y umbrales iniciales definidos. |
| 1. Analisis individual | Completada | 2026-10-26 | 2026-10-26 | Endpoint, pestana, permisos, segmentos y validacion responsive. |
| 2. Panel general | Completada | 2026-10-26 | 2026-10-26 | Panel, filtros, CSV, paginacion, permisos y validacion responsive. |
| 3. Seguimientos y agenda | Completada | 2026-10-27 | 2026-10-27 | Tareas auditables, responsables, agenda, historial y validacion responsive. |
| 4. Taller y postventa | Completada | 2026-10-27 | 2026-10-27 | Señales verificables, evidencia, deduplicacion, confirmacion manual y validacion responsive. |
| 5. Atenea CRM | Completada | 2026-10-27 | 2026-10-27 | Analisis oficial explicable, permisos, referencias, borradores y confirmacion manual. |
| 6. Comunicaciones | Completada | 2026-10-27 | 2026-10-27 | Listas segmentadas, borradores, resultados, exclusiones, historial y metricas de 30 dias. |

## Proximo paso

Usar el circuito completo en operacion real y revisar semanalmente la calidad de oportunidades, contactos y conversiones antes de agregar automatizaciones externas.
