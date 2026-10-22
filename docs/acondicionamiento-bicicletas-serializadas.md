# Acondicionamiento y ofertas por bicicleta serializada

## Estado del documento

- Estado general: en implementacion
- Fase activa: Fase 5 - integracion con Caja y pedidos
- Ultima actualizacion: 2026-10-07
- Objetivo: controlar reparaciones, agregados, costos y ofertas de cada bicicleta fisica mediante su numero de cuadro.

Este documento es la fuente de verdad para implementar el acondicionamiento de bicicletas en stock. Se debe actualizar al iniciar o cerrar una fase, al cambiar una regla comercial y al encontrar una excepcion operativa.

## Problema a resolver

Una variante identifica un modelo, talle y color, pero no distingue dos bicicletas fisicas iguales. Actualmente una oferta se aplica a toda la variante. Esto impide resolver correctamente casos donde:

- Algunas unidades requieren reemplazar componentes.
- Solo determinados numeros de cuadro deben quedar en oferta.
- Otras unidades del mismo modelo deben venderse a precio normal.
- Los componentes colocados deben descontarse del stock y sumarse al costo real de una unidad.
- Caja debe saber exactamente que bicicleta esta vendiendo.

El caso inicial son las Zoom Two recibidas con cubiertas defectuosas. Algunas unidades se acondicionaran para venta normal y otras se ofreceran individualmente. Ninguna bicicleta pendiente o insegura debe quedar habilitada para vender.

## Principio de identidad

- El SKU o variante responde **que producto es**.
- El numero de cuadro responde **que unidad fisica es**.
- El precio, la condicion tecnica y los agregados individuales deben seguir a la unidad fisica.
- Dos bicicletas con la misma variante pueden tener costos, condiciones comerciales y precios diferentes.

## Situacion actual verificada

El sistema ya dispone de:

- Bicicletas serializadas por numero de cuadro.
- Estados operativos: disponible, reservada, vendida pendiente de entrega y entregada.
- Seleccion obligatoria del numero de cuadro en Caja.
- Movimientos de stock auditados.
- Consumo de componentes con costo congelado en el modulo Armado.
- Costo de fabricacion individual para bicicletas fabricadas internamente.
- Ofertas por variante con vigencia, historial y trazabilidad en la venta.
- Auditoria de usuario, fecha y accion.

Limitaciones actuales:

- Caja muestra la oferta resuelta al elegir el cuadro, pero todavia necesita una explicacion operativa mas clara y busqueda directa por numero de cuadro.
- Reservas y pedidos de cliente todavia no comparten toda la resolucion de ofertas individuales.
- No existe una etiqueta QR operativa para identificar rapidamente la unidad.

## Caso de aceptacion inicial: Zoom Two

Unidades encontradas al 2026-10-07:

| ID unidad | Numero de cuadro | Variante | Estado actual |
| --- | --- | --- | --- |
| 128 | ZY2601172 | VAR-00000645 - Talle S - Negro/Rosa | disponible |
| 137 | ZY2604318 | VAR-00000645 - Talle S - Negro/Rosa | disponible |
| 134 | ZY2601003 | VAR-00000646 - Talle S - Negro/Rojo | entregada |
| 129 | JY2607136 | VAR-00000647 - Talle M - Negro/Teal | disponible |
| 130 | ZY2601194 | VAR-00000648 - Talle S - Negro/Teal | disponible |

Los cuadros `ZY2601172` y `ZY2604318` comparten variante. El sistema nuevo debe permitir que uno quede a precio normal y el otro en oferta sin duplicar productos ni variantes.

La unidad ya entregada no debe modificarse durante la migracion.

## Reglas no negociables

- Una bicicleta pendiente, en proceso o bloqueada no puede venderse ni reservarse como disponible.
- Una unidad se identifica por `id_bicicleta_serializada` y numero de cuadro.
- Todo componente inventariable colocado debe generar una salida real de stock.
- El costo utilizado queda congelado al confirmar el consumo.
- La confirmacion del acondicionamiento y los movimientos de stock deben ejecutarse en una sola transaccion.
- Una correccion posterior debe revertir o compensar movimientos; nunca borrar trazabilidad.
- El costo original de una pieza defectuosa es un costo hundido. El reemplazo agrega costo salvo que exista una nota de credito o recupero registrado.
- Una oferta individual nunca habilita la venta de una bicicleta tecnicamente no apta.
- Caja vuelve a validar estado, precio y vigencia en backend antes de crear la venta.
- Toda modificacion registra usuario, fecha, motivo y valores anteriores/nuevos.

## Alcance funcional final

### Ficha de unidad

Cada bicicleta serializada debe mostrar:

- Producto, variante, SKU e imagen.
- Numero de cuadro e ID interno.
- Sucursal y ubicacion fisica.
- Estado de inventario existente.
- Estado tecnico: `pendiente_revision`, `en_acondicionamiento`, `lista` o `bloqueada`.
- Condicion comercial: `normal`, `reacondicionada` u `oferta`.
- Costo base congelado.
- Costo de acondicionamiento.
- Costo total de la unidad.
- Observacion interna.
- Texto comercial visible para el cliente, cuando corresponda.
- Historial de intervenciones, componentes, precios y responsables.

### Acondicionamiento

Una intervencion puede incluir:

- Reemplazo: se retira una pieza defectuosa y se coloca otra.
- Mejora incluida: se agrega un componente que forma parte del precio de la bicicleta.
- Agregado incluido: accesorio entregado como parte de la unidad.
- Trabajo o gasto no inventariable: mano de obra externa, consumible u otro costo.

Los extras vendidos por separado al cliente siguen siendo items independientes de la venta y no forman parte del costo de acondicionamiento.

### Resolucion del costo

```text
costo base congelado de la bicicleta
+ componentes instalados
+ trabajos y gastos adicionales
- recuperos o notas de credito asignados a la unidad
= costo total individual
```

Para bicicletas compradas, el costo base se congela al serializar. Para bicicletas fabricadas, se conserva el costo final de la orden de Armado. El costo de venta debe usar siempre el costo total individual cuando exista.

### Resolucion del precio

Prioridad propuesta:

1. Precio manual autorizado en la venta.
2. Oferta vigente del numero de cuadro.
3. Oferta vigente de la variante.
4. Precio minorista normal de la variante.

Cada oferta debe declarar una politica de contado:

- `precio_lista_promocional`: puede recibir luego descuentos por medio de pago.
- `precio_final_contado`: efectivo y transferencia no aplican otro descuento.

La politica recomendada por defecto es `precio_final_contado` para evitar descuentos acumulados inesperados.

## Modelo de datos propuesto

Ampliaciones a `bicicletas_serializadas`:

- `estado_tecnico`.
- `condicion_comercial`.
- `ubicacion_fisica`.
- `costo_base_unitario`.
- `costo_acondicionamiento`.
- `costo_total_unitario`.
- `texto_comercial`.
- `fecha_revision_tecnica`.
- `id_usuario_revision_tecnica`.

Entidades nuevas o equivalentes:

- `bicicleta_acondicionamientos`: cabecera, unidad, estado, motivo, responsables y fechas.
- `bicicleta_acondicionamiento_items`: componentes, cantidades, tipo de intervencion, costos y movimientos.
- `bicicleta_acondicionamiento_costos`: trabajos o gastos no inventariables.
- `oferta_bicicletas_serializadas`: relacion entre una oferta y los numeros de cuadro alcanzados.
- `bicicleta_serializada_eventos`: se puede resolver mediante la auditoria existente si conserva metadata suficiente.

Se reutilizan:

- `bicicletas_serializadas` y su seleccion en Caja.
- Productos y variantes del catalogo.
- Stock por sucursal y movimientos de stock.
- Patron de consumo y reversion del modulo Armado.
- Ofertas actuales para promociones por variante.
- Auditoria, usuarios y permisos.
- Costos congelados de `venta_items`.

## Flujo operativo final

1. La bicicleta ingresa al stock y se serializa por numero de cuadro.
2. Se congela su costo base.
3. Si el lote requiere control, queda `pendiente_revision` y no disponible para vender.
4. El operador abre **Acondicionar** desde la ficha de la unidad.
5. Carga componentes instalados, reemplazos y costos adicionales.
6. El sistema presenta una vista previa de stock y costo.
7. Al confirmar, descuenta stock, congela costos y actualiza el costo individual.
8. El operador completa el control y marca la unidad `lista`.
9. Define condicion normal, reacondicionada u oferta.
10. Imprime o consulta la etiqueta QR de la unidad.
11. Caja escanea o selecciona el cuadro.
12. Backend valida estado y resuelve precio y costo de esa unidad.
13. Venta, comprobante y rentabilidad conservan la trazabilidad individual.

## Fases de implementacion

### Fase 0 - Reglas y alcance

Objetivo: cerrar las decisiones funcionales antes de modificar datos o ventas.

- [x] Auditar serializadas, ofertas, Caja, stock, Armado y costos de venta.
- [x] Confirmar que la identidad comercial debe ser el numero de cuadro.
- [x] Confirmar que no se duplicaran productos o variantes por condicion.
- [x] Definir nombres finales de estados tecnicos y comerciales.
- [x] Usar ubicacion fisica como texto libre durante la primera etapa; evaluar una lista cerrada con el uso real.
- [x] Usar `precio_final_contado` como politica predeterminada en el alta desde la interfaz, conservando `precio_lista_promocional` para ofertas historicas y cuando el operador lo elija expresamente.
- [x] Usar provisoriamente el permiso de gestion de catalogo para editar la ficha; separar permisos al incorporar acondicionamientos y reversiones.
- [x] Definir tratamiento de piezas retiradas: descarte, garantia o recupero.

Criterio de cierre: reglas escritas sin ambiguedades y caso Zoom clasificado por cuadro.

### Fase 1 - Ficha individual y bloqueo tecnico

Objetivo: saber que condicion tiene cada bicicleta fisica y evitar ventas incorrectas.

- [x] Crear migracion con estado tecnico, condicion comercial, ubicacion y costo base.
- [x] Congelar costo base al serializar nuevas bicicletas.
- [x] Migrar bicicletas existentes con valores iniciales y origen de costo identificable.
- [x] Permitir editar ubicacion, observaciones y texto comercial.
- [x] Mostrar condicion y costo en la ficha de Serializadas.
- [x] Excluir de disponibles las unidades no marcadas como `lista`.
- [x] Bloquear en backend venta y reserva de unidades pendientes o bloqueadas.
- [x] Registrar todos los cambios en auditoria.

Implementada el 2026-10-07. La migracion fue aplicada en desarrollo y pruebas. Las unidades Zoom existentes no se reclasificaron automaticamente para evitar bloquear una bicicleta que ya hubiera sido reparada fuera del sistema; deben revisarse por numero de cuadro desde la ficha operativa.

Criterio de cierre: una unidad pendiente no puede venderse y cada cuadro tiene una ficha operativa editable.

### Fase 2 - Orden de acondicionamiento

Objetivo: registrar el trabajo realizado sobre una bicicleta que ya existe.

- [x] Crear cabecera e items de acondicionamiento.
- [x] Buscar componentes por SKU, EAN, codigo o nombre.
- [x] Permitir reemplazo, mejora y agregado incluido.
- [x] Permitir costos no inventariables con motivo.
- [x] Incorporar borrador, confirmado y revertido.
- [x] Mostrar disponibilidad antes de confirmar.
- [x] Permitir carga repetida para dos cubiertas u otros componentes.
- [x] Agregar historial visible en la ficha de la unidad.

Implementada el 2026-10-07. Confirmar en esta etapa sella el plan y cambia la unidad a `en_acondicionamiento`, pero no consume stock ni modifica costos. Esa aplicacion transaccional corresponde a la Fase 3. La reversion de Fase 2 restaura el estado tecnico anterior porque aun no existen movimientos de inventario.

Criterio de cierre: una Zoom puede registrar dos cubiertas nuevas antes de modificar stock.

### Fase 3 - Stock, costos y reversion

Objetivo: convertir el acondicionamiento confirmado en movimientos contables y de inventario confiables.

- [x] Consumir componentes desde la sucursal de la bicicleta.
- [x] Congelar costo promedio real de cada componente.
- [x] Recalcular costo de acondicionamiento y costo total individual.
- [x] Vincular cada item con su movimiento de stock.
- [x] Implementar reversion completa y auditada.
- [x] Registrar recuperos o notas de credito por unidad sin borrar el costo original.
- [x] Hacer que Ventas utilice el costo total individual.
- [x] Exponer y congelar el origen del costo en Venta; Rentabilidad reutiliza ese costo congelado.

Implementada el 2026-10-07. Aplicar un trabajo confirmado descuenta los componentes en una sola transaccion, congela sus costos, resta recuperos identificados y deja la unidad lista con su nuevo costo total. La reversion genera movimientos compensatorios y restaura el costo y estado tecnico anteriores sin borrar historial. Cada item de venta conserva tanto el costo como su origen, evitando que una modificacion posterior de la bicicleta cambie la explicacion historica.

Criterio de cierre: stock, costo de la bicicleta y rentabilidad concilian despues de confirmar o revertir una intervencion.

### Fase 4 - Oferta por numero de cuadro

Objetivo: aplicar promociones solo a las unidades elegidas.

- [x] Ampliar ofertas con alcance `variante` o `unidades`.
- [x] Permitir seleccionar varios numeros de cuadro disponibles y listos.
- [x] Impedir incluir unidades entregadas, reservadas, pendientes o bloqueadas.
- [x] Definir precio, vigencia, motivo y politica de contado.
- [x] Evitar superposiciones para la misma unidad.
- [x] Mostrar costo, ganancia y margen antes de guardar.
- [x] Conservar snapshots de oferta en la venta.
- [x] Separar estados programada, vigente, vencida e inactiva.

Implementada el 2026-10-07. Las ofertas generales y por cuadro pueden convivir; la oferta individual vigente tiene prioridad. El alta valida que las unidades esten disponibles y tecnicamente listas, muestra costo y margen estimado y evita superposiciones entre ofertas individuales. La venta congela alcance y politica. Para `precio_final_contado`, Cobros protege esa base y aplica descuentos de efectivo o transferencia solamente sobre los demas items, incluso en ventas mixtas o con pago inicial.

Criterio de cierre: dos bicicletas de la misma variante pueden venderse simultaneamente, una a precio normal y otra en oferta.

### Fase 5 - Integracion con Caja y pedidos

Objetivo: que el operador identifique la unidad y cobre el precio correcto sin interpretar notas manuales.

- [x] Mejorar el selector de cuadros con condicion, ubicacion y precio.
- [x] Permitir busqueda o escaneo directo por numero de cuadro.
- [x] Recalcular el carrito al elegir o cambiar la unidad.
- [x] Mostrar por que se aplica precio normal, oferta individual u oferta general.
- [x] Validar nuevamente todo al crear la venta.
- [x] Integrar el mismo comportamiento en reservas y pedidos de cliente.
- [x] Mostrar componentes incluidos relevantes en el detalle de venta.
- [x] Mantener el costo individual congelado en `venta_items`.

Implementada el 2026-10-08. Caja puede buscar o escanear un numero de cuadro, cargar la unidad exacta y explicar su condicion, ubicacion y origen del precio. Cambiar la unidad recalcula la oferta sin confiar en el valor enviado por el navegador. Reservas y pedidos de cliente exigen elegir cada cuadro y congelan oferta, politica de contado y precio al convertirse en venta. El detalle de venta muestra los componentes incorporados y conserva el costo individual historico.

Criterio de cierre: Caja escanea un cuadro y el sistema determina sin ambiguedad si puede venderse, cuanto cobrar y que costo aplicar.

### Fase 6 - Etiquetas, informes y cierre operativo

Objetivo: completar el circuito fisico y medir el resultado comercial.

- [x] Generar etiqueta QR por unidad.
- [x] Mostrar producto, variante, ID y numero de cuadro.
- [x] Incorporar filtros por ubicacion, estado tecnico y condicion comercial.
- [x] Informar unidades pendientes, listas, normales y en oferta.
- [x] Medir costo agregado, precio, margen y resultado por unidad.
- [x] Medir ventas y ganancia por oferta individual.
- [x] Detectar ofertas vencidas y ofrecer cierre masivo.
- [x] Documentar procedimiento operativo para recepcion, taller interno y Caja.

Implementada el 2026-10-08. La pantalla de Serializadas funciona como tablero operativo: resume estados tecnicos y comerciales, filtra por ubicacion y condicion, explica costo, precio y margen por cuadro y separa el resultado real cuando la unidad ya fue vendida. Las ventas realizadas con ofertas individuales se resumen sin mezclarlas con ofertas generales. La etiqueta de deposito usa un QR que contiene el numero de cuadro y muestra producto, variante e ID. El panel de Ofertas detecta promociones activas vencidas y permite cerrarlas juntas con auditoria individual.

Criterio de cierre: una unidad puede seguirse desde su ingreso hasta su venta, incluyendo acondicionamiento, ubicacion, precio, costo y resultado.

### Fase 7 - Piezas retiradas y resolucion

Objetivo: evitar que una pieza reemplazada quede como una nota libre y separar su destino fisico de cualquier recupero economico.

- [x] Exigir descripcion y destino juntos cuando un reemplazo retira una pieza.
- [x] Permitir destinos `descarte`, `garantia` y `recuperable`.
- [x] Registrar estado y resolucion con fecha, usuario e historial.
- [x] Evitar que una pieza retirada vuelva automaticamente al stock vendible.
- [x] Mantener notas de credito y compensaciones en el circuito de recuperos economicos.
- [x] Marcar la trazabilidad fisica como revertida al revertir el acondicionamiento.

Implementada el 2026-10-08. El destino se declara al cargar el componente de reemplazo. Descarte queda finalizado, garantia queda en seguimiento y recuperable queda pendiente de revision. Una garantia compensada debe tener su recupero economico cargado por separado para modificar el costo de la unidad; el estado fisico nunca altera stock ni costos por si solo.

Criterio de cierre: cada pieza retirada tiene destino y resolucion auditables sin crear stock ni beneficios economicos ficticios.

## Procedimiento operativo por unidad

### Recepcion y serializacion

1. Ingresar la mercaderia y confirmar el costo de la variante.
2. Serializar cada bicicleta con su numero de cuadro real.
3. Verificar producto, variante, sucursal y costo base congelado.
4. Imprimir la etiqueta QR y pegarla en la unidad o su documentacion interna.
5. Si necesita control, dejarla en `pendiente_revision`; si esta lista, mantenerla en `lista`.

### Taller interno y acondicionamiento

1. Buscar la bicicleta por QR o numero de cuadro.
2. Abrir su acondicionamiento y cargar componentes, cantidades y costos adicionales.
3. Revisar disponibilidad y costo previsto antes de confirmar.
4. Aplicar el trabajo para consumir stock y recalcular el costo individual.
5. Completar ubicacion, condicion comercial y texto comercial; marcarla `lista` solo despues del control.
6. Resolver las piezas retiradas pendientes. Si el proveedor reconoce dinero o una nota de credito, registrar tambien el recupero economico.

### Oferta y Caja

1. Para liquidar unidades puntuales, crear una oferta por numeros de cuadro.
2. Revisar costo, ganancia y margen antes de activarla.
3. En Caja, escanear el QR o buscar el cuadro y confirmar la unidad exacta.
4. El sistema resuelve precio normal, oferta general u oferta individual y vuelve a validarlo al crear la venta.
5. Luego de la venta, consultar en Serializadas el precio, costo congelado y ganancia real de esa unidad.

### Cierre operativo

1. Revisar periodicamente pendientes tecnicos, ubicaciones faltantes y unidades en oferta.
2. Usar `Cerrar vencidas` en Ofertas para desactivar promociones finalizadas.
3. Comparar el resumen de ventas y ganancia de ofertas individuales antes de decidir nuevas liquidaciones.

## Migracion inicial

- Bicicletas entregadas: conservar sin cambios funcionales.
- Bicicletas disponibles comunes: iniciar como `lista` y `normal`.
- Costo base migrado: tomar el costo vigente con marca de origen `migracion`; no fingir que es un snapshot historico.
- Zoom Two disponibles: iniciar como `pendiente_revision` hasta clasificarlas individualmente.
- Ofertas generales Zoom: mantener durante el desarrollo, pero reemplazarlas por ofertas por cuadro antes de habilitar el nuevo flujo.
- No eliminar ofertas o movimientos historicos existentes.

## Pruebas obligatorias

- Dos cuadros de la misma variante pueden tener condiciones y precios distintos.
- Una unidad pendiente no aparece como vendible ni reservable.
- Confirmar dos cubiertas descuenta exactamente dos unidades de stock.
- El costo de los componentes queda congelado aunque cambie luego el costo promedio.
- Revertir repone stock y resta el costo agregado sin borrar el historial.
- Caja recalcula el precio al cambiar el cuadro seleccionado.
- Una oferta individual no afecta otros cuadros de la variante.
- La politica `precio_final_contado` no aplica dos veces el descuento.
- Una venta conserva oferta, costo y componentes aunque cambie la ficha posteriormente.
- Rentabilidad usa el costo total individual y concilia con la venta.
- Una pieza retirada no aumenta stock y una garantia no reduce costo sin un recupero economico registrado.

## Fuera de alcance

- Vender bicicletas tecnicamente inseguras bajo la etiqueta de oferta.
- Crear variantes duplicadas para representar defectos o trabajos internos.
- Usar una OT de cliente para bicicletas que todavia pertenecen al negocio.
- Modificar silenciosamente costos historicos de ventas ya realizadas.
- Permitir consumos de stock sin confirmacion y auditoria.

## Registro de decisiones

| Fecha | Decision | Motivo |
| --- | --- | --- |
| 2026-10-07 | La unidad fisica se identifica por numero de cuadro. | Dos bicicletas de la misma variante pueden tener condicion, costo y precio diferentes. |
| 2026-10-07 | El acondicionamiento se integra con Serializadas. | Taller corresponde a bicicletas de clientes y Armado crea unidades nuevas. |
| 2026-10-07 | Se reutiliza el patron de consumo y reversion de Armado. | Evitar una segunda logica de stock y costos. |
| 2026-10-07 | Las ofertas podran tener alcance por variante o por unidades. | Conservar promociones generales y resolver liquidaciones individuales. |
| 2026-10-07 | Una oferta individual vigente tiene prioridad sobre la oferta general de la variante. | Resolver un precio unico y previsible al seleccionar el numero de cuadro. |
| 2026-10-07 | El precio final contado queda protegido en la venta y en cada tramo de pago. | Evitar aplicar dos veces el descuento de efectivo o transferencia. |
| 2026-10-08 | El destino fisico de una pieza retirada se registra separado del recupero economico. | Una pieza en garantia no es stock vendible ni una nota de credito confirmada. |

## Proximo paso

Validar el circuito completo con las primeras bicicletas reales y ajustar los estados solamente si el uso operativo muestra un caso no contemplado.
