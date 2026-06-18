CREATE TABLE IF NOT EXISTS public.configuracion_negocio (
    id smallint PRIMARY KEY DEFAULT 1,
    nombre_negocio text NOT NULL DEFAULT 'Emprendimiento Agus',
    direccion text,
    telefono text,
    horarios_retiro text NOT NULL DEFAULT 'Lunes a viernes
09:00 a 12:00
16:30 a 20:00

Sábados
09:00 a 12:00
17:00 a 19:00',
    whatsapp_cierre text NOT NULL DEFAULT 'Gracias por confiar en nosotros.
¡Te esperamos!',
    texto_beneficio_pago text NOT NULL DEFAULT 'Abonando en efectivo o transferencia tenés 10% de descuento sobre los trabajos presupuestados.',
    whatsapp_retiro_mostrar_total boolean NOT NULL DEFAULT true,
    whatsapp_retiro_mostrar_trabajos boolean NOT NULL DEFAULT true,
    plantilla_turno_confirmacion text NOT NULL DEFAULT 'Hola {cliente_nombre} 👋

Tu turno quedó agendado para el {fecha_turno} {momento_turno} en {nombre_negocio}.

Trabajo solicitado:
{tipo_servicio}

{fecha_prometida_bloque}{whatsapp_cierre} 🚲',
    plantilla_turno_recordatorio text NOT NULL DEFAULT 'Hola {cliente_nombre} 👋

Te recordamos que el {fecha_turno} {momento_turno} te esperamos en {nombre_negocio} para recibir tu bicicleta.

Trabajo solicitado:
{tipo_servicio}

Si necesitás reprogramar, avisanos con anticipación.

{whatsapp_cierre} 🚲',
    plantilla_turno_aviso text NOT NULL DEFAULT 'Hola {cliente_nombre} 👋

Te avisamos desde {nombre_negocio} por tu turno de taller del {fecha_turno}.

Trabajo solicitado:
{tipo_servicio}

{fecha_prometida_bloque}Cualquier cambio te avisamos por este medio. 🚲',
    plantilla_retiro_taller text NOT NULL DEFAULT '🚲 *¡Tu bicicleta está lista para retirar!*

Hola {cliente_nombre} 👋

Tenemos buenas noticias:

🔹 {bicicleta}

ya se encuentra lista para retirar.

{trabajos_bloque}{total_bloque}
📍 *{nombre_negocio}*

🕒 *Horarios de retiro:*

{horarios_retiro}

🙌 {whatsapp_cierre} 🚲',
    plantilla_cotizacion_whatsapp text NOT NULL DEFAULT 'Hola {cliente_nombre}, te paso la cotización {numero_cotizacion}.

Tipo: {tipo_cotizacion}.
{consulta_bloque}{detalle_bloque}
Total estimado: {total}
{validez_bloque}
No reserva stock ni genera deuda hasta que la confirmes.',
    condiciones_presupuesto_taller text NOT NULL DEFAULT 'Presupuesto no fiscal. No válido como factura.
Validez estimada: 7 días desde la fecha de emisión.
El importe puede variar si durante la reparación aparecen fallas o repuestos no detectados inicialmente.
{texto_beneficio_pago}',
    condiciones_cotizacion text NOT NULL DEFAULT 'Cotización no fiscal. No válida como factura.
No reserva stock ni genera deuda hasta que sea confirmada.
Los precios pueden variar al vencer la validez indicada.',
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT configuracion_negocio_singleton CHECK (id = 1)
);

INSERT INTO public.configuracion_negocio (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
