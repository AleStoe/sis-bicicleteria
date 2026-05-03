from app.modules.auditoria import service as auditoria_service


def test_registrar_evento_guarda_metadata_origen_y_detalle(db_conn, seed_venta_basica):
    evento_id = auditoria_service.registrar_evento(
        db_conn,
        id_usuario=seed_venta_basica["usuario_id"],
        id_sucursal=seed_venta_basica["sucursal_id"],
        entidad="venta",
        entidad_id=123,
        accion="test_auditoria_metadata",
        detalle="Evento de prueba",
        metadata={
            "monto": "15000.00",
            "items": [1, 2, 3],
        },
        origen_tipo="venta",
        origen_id=123,
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM auditoria_eventos
            WHERE id = %s
            """,
            (evento_id,),
        )
        evento = cur.fetchone()

    assert evento is not None
    assert evento["entidad"] == "venta"
    assert evento["accion"] == "test_auditoria_metadata"
    assert evento["detalle"] == "Evento de prueba"
    assert evento["origen_tipo"] == "venta"
    assert evento["origen_id"] == 123
    assert evento["metadata"]["monto"] == "15000.00"
    assert evento["metadata"]["items"] == [1, 2, 3]