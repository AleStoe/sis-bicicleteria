from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

def insert_auditoria_evento(conn, data: dict):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO auditoria_eventos (
                id_usuario,
                id_sucursal,
                entidad,
                entidad_id,
                accion,
                detalle,
                metadata,
                origen_tipo,
                origen_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
           (
                data["id_usuario"],
                data.get("id_sucursal"),
                data["entidad"],
                data["entidad_id"],
                data["accion"],
                data.get("detalle"),
                Jsonb(data.get("metadata")) if data.get("metadata") is not None else None,
                data.get("origen_tipo"),
                data.get("origen_id"),
            ),
        )
        return cur.fetchone()["id"]