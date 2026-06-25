def get_configuracion_negocio(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM configuracion_negocio WHERE id = 1")
        return cur.fetchone()


def get_configuracion_negocio_columnas(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'configuracion_negocio'
            """
        )
        return {row["column_name"] for row in cur.fetchall()}


def upsert_configuracion_negocio(conn, data: dict):
    campos = [
        "nombre_negocio",
        "direccion",
        "telefono",
        "horarios_retiro",
        "whatsapp_cierre",
        "texto_beneficio_pago",
        "porcentaje_descuento_contado_calculadora_precios",
        "whatsapp_retiro_mostrar_total",
        "whatsapp_retiro_mostrar_trabajos",
        "plantilla_turno_confirmacion",
        "plantilla_turno_recordatorio",
        "plantilla_turno_aviso",
        "plantilla_retiro_taller",
        "plantilla_cotizacion_whatsapp",
        "condiciones_presupuesto_taller",
        "condiciones_cotizacion",
    ]
    columnas_existentes = get_configuracion_negocio_columnas(conn)
    if columnas_existentes:
        campos = [campo for campo in campos if campo in columnas_existentes]

    columnas = ", ".join(["id", *campos])
    valores = ", ".join(["%(id)s", *(f"%({campo})s" for campo in campos)])
    updates = ", ".join(f"{campo} = EXCLUDED.{campo}" for campo in campos)

    payload = {"id": 1, **{campo: data[campo] for campo in campos}}

    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO configuracion_negocio ({columnas})
            VALUES ({valores})
            ON CONFLICT (id) DO UPDATE
            SET {updates},
                actualizado_en = now()
            RETURNING *
            """,
            payload,
        )
        return cur.fetchone()
