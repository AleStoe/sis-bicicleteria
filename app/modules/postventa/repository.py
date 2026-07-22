from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


CASO_SELECT = """
    SELECT
        pc.*,
        c.nombre AS cliente_nombre,
        bs.numero_cuadro AS bicicleta_numero_cuadro,
        NULLIF(TRIM(CONCAT_WS(
            ' ',
            bc.marca,
            bc.modelo,
            CASE WHEN bc.rodado IS NOT NULL THEN 'Rod. ' || bc.rodado ELSE NULL END,
            bc.color,
            CASE WHEN bc.numero_cuadro IS NOT NULL THEN 'Cuadro ' || bc.numero_cuadro ELSE NULL END
        )), '') AS bicicleta_cliente_descripcion,
        NULLIF(TRIM(CONCAT_WS(' - ', p.nombre, v.nombre_variante)), '') AS variante_descripcion,
        pr.nombre AS proveedor_nombre
    FROM postventa_casos pc
    INNER JOIN clientes c ON c.id = pc.id_cliente
    LEFT JOIN bicicletas_clientes bc ON bc.id = pc.id_bicicleta_cliente
    LEFT JOIN bicicletas_serializadas bs ON bs.id = pc.id_bicicleta_serializada
    LEFT JOIN variantes v ON v.id = pc.id_variante
    LEFT JOIN productos p ON p.id = v.id_producto
    LEFT JOIN proveedores pr ON pr.id = pc.id_proveedor
"""


def insert_caso(conn, data: dict) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO postventa_casos (
                tipo_caso,
                prioridad,
                id_cliente,
                id_venta_origen,
                id_venta_item_origen,
                id_bicicleta_cliente,
                id_bicicleta_serializada,
                id_variante,
                id_proveedor,
                motivo_cliente,
                observaciones,
                id_usuario_creador
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["tipo_caso"],
                data["prioridad"],
                data["id_cliente"],
                data.get("id_venta_origen"),
                data.get("id_venta_item_origen"),
                data.get("id_bicicleta_cliente"),
                data.get("id_bicicleta_serializada"),
                data.get("id_variante"),
                data.get("id_proveedor"),
                data["motivo_cliente"],
                data.get("observaciones"),
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def get_caso_by_id(conn, caso_id: int, *, for_update: bool = False):
    suffix = " FOR UPDATE OF pc" if for_update else ""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            {CASO_SELECT}
            WHERE pc.id = %s
            {suffix}
            """,
            (caso_id,),
        )
        return cur.fetchone()


def listar_casos(conn, filtros: dict):
    params = []
    where = []
    if filtros.get("estado"):
        where.append("pc.estado = %s")
        params.append(filtros["estado"])
    if filtros.get("tipo_caso"):
        where.append("pc.tipo_caso = %s")
        params.append(filtros["tipo_caso"])
    if filtros.get("id_cliente") is not None:
        where.append("pc.id_cliente = %s")
        params.append(filtros["id_cliente"])
    if filtros.get("id_bicicleta_cliente") is not None:
        where.append("pc.id_bicicleta_cliente = %s")
        params.append(filtros["id_bicicleta_cliente"])
    if filtros.get("id_venta_origen") is not None:
        where.append("pc.id_venta_origen = %s")
        params.append(filtros["id_venta_origen"])
    if filtros.get("q"):
        where.append(
            """
            (
                pc.codigo ILIKE %s
                OR c.nombre ILIKE %s
                OR pc.motivo_cliente ILIKE %s
                OR bs.numero_cuadro ILIKE %s
            )
            """
        )
        term = f"%{filtros['q']}%"
        params.extend([term, term, term, term])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    limit = filtros.get("limit") or 100
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            {CASO_SELECT}
            {where_sql}
            ORDER BY pc.fecha_apertura DESC, pc.id DESC
            LIMIT %s
            """,
            (*params, limit),
        )
        return cur.fetchall()


def update_caso(conn, caso_id: int, data: dict):
    campos = []
    params = []
    for campo, valor in data.items():
        if campo == "id_usuario":
            continue
        campos.append(f"{campo} = %s")
        params.append(valor)
    if not campos:
        return caso_id

    campos.append("updated_at = NOW()")
    params.append(caso_id)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            UPDATE postventa_casos
            SET {', '.join(campos)}
            WHERE id = %s
            RETURNING id
            """,
            params,
        )
        row = cur.fetchone()
        return row["id"] if row else None


def update_estado(conn, caso_id: int, *, estado: str, id_usuario: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE postventa_casos
            SET estado = %s,
                id_usuario_cierre = CASE WHEN %s IN ('cerrado', 'cancelado') THEN %s ELSE id_usuario_cierre END,
                fecha_cierre = CASE WHEN %s IN ('cerrado', 'cancelado') THEN NOW() ELSE fecha_cierre END,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (estado, estado, id_usuario, estado, caso_id),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def cerrar_caso(conn, caso_id: int, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE postventa_casos
            SET estado = 'cerrado',
                resultado_final = %s,
                resolucion_aplicada = %s,
                observaciones = COALESCE(%s, observaciones),
                id_usuario_cierre = %s,
                fecha_cierre = NOW(),
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (
                data["resultado_final"],
                data["resolucion_aplicada"],
                data.get("observaciones"),
                data["id_usuario"],
                caso_id,
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def reabrir_caso(conn, caso_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE postventa_casos
            SET estado = 'reabierto',
                fecha_cierre = NULL,
                id_usuario_cierre = NULL,
                updated_at = NOW()
            WHERE id = %s
            RETURNING id
            """,
            (caso_id,),
        )
        row = cur.fetchone()
        return row["id"] if row else None


def insert_evento(conn, data: dict) -> int:
    metadata = data.get("metadata")
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO postventa_eventos (
                id_caso_postventa,
                tipo_evento,
                detalle,
                metadata,
                id_usuario
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                data["id_caso_postventa"],
                data["tipo_evento"],
                data.get("detalle"),
                Jsonb(metadata) if metadata is not None else None,
                data["id_usuario"],
            ),
        )
        return cur.fetchone()["id"]


def get_eventos_caso(conn, caso_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT *
            FROM postventa_eventos
            WHERE id_caso_postventa = %s
            ORDER BY fecha ASC, id ASC
            """,
            (caso_id,),
        )
        return cur.fetchall()


def exists_by_id(conn, tabla: str, entidad_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(f"SELECT 1 FROM {tabla} WHERE id = %s", (entidad_id,))
        return cur.fetchone() is not None


def get_venta_item(conn, item_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, id_venta, id_variante, id_bicicleta_serializada
            FROM venta_items
            WHERE id = %s
            """,
            (item_id,),
        )
        return cur.fetchone()


def get_bicicleta_cliente(conn, bicicleta_id: int):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, id_cliente, id_bicicleta_serializada
            FROM bicicletas_clientes
            WHERE id = %s
            """,
            (bicicleta_id,),
        )
        return cur.fetchone()
