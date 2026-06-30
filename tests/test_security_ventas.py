import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.usuarios.service import hash_password
from tests.conftest import asignar_rol_usuario


def _asegurar_permiso(db_conn, codigo: str):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO permisos (codigo, descripcion)
            VALUES (%s, %s)
            ON CONFLICT (codigo) DO UPDATE
            SET descripcion = EXCLUDED.descripcion
            RETURNING id
            """,
            (codigo, f"Permiso test {codigo}"),
        )
        return cur.fetchone()["id"]


def _asignar_permiso_rol(db_conn, rol: str, codigo: str):
    permiso_id = _asegurar_permiso(db_conn, codigo)
    with db_conn.cursor() as cur:
        cur.execute("SELECT id FROM roles WHERE nombre = %s", (rol,))
        rol_id = cur.fetchone()["id"]
        cur.execute(
            """
            INSERT INTO rol_permisos (id_rol, id_permiso)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (rol_id, permiso_id),
        )


def _crear_actor(db_conn, *, username: str, rol: str, permisos=()):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO usuarios (
                nombre,
                username,
                email,
                password_hash,
                activo
            )
            VALUES (%s, %s, %s, %s, TRUE)
            RETURNING id
            """,
            (
                username.upper(),
                username,
                f"{username}@example.com",
                hash_password("Password123"),
            ),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, rol)
    for permiso in permisos:
        _asignar_permiso_rol(db_conn, rol, permiso)
    db_conn.commit()

    token = crear_token_usuario(
        {
            "id": usuario_id,
            "username": username,
            "rol": rol,
        }
    )
    return usuario_id, token


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def _payload_venta(seed, **extras):
    payload = {
        "id_cliente": seed["cliente_id"],
        "id_sucursal": seed["sucursal_id"],
        "tipo_precio": "minorista",
        "items": [
            {
                "id_variante": seed["variante_id"],
                "cantidad": 1,
            }
        ],
    }
    payload.update(extras)
    return payload


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def test_operador_puede_crear_venta_comun_y_actor_no_se_puede_falsificar(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    actor_id, token = _crear_actor(
        db_conn,
        username="operador_venta_comun",
        rol="operador",
        permisos=("crear_venta",),
    )

    response = client.post(
        "/ventas/",
        headers=_headers(token),
        json=_payload_venta(
            seed_venta_basica,
            id_usuario=seed_venta_basica["usuario_id"],
        ),
    )
    assert response.status_code == 200, response.text
    venta_id = response.json()["venta_id"]

    with db_conn.cursor() as cur:
        cur.execute(
            "SELECT id_usuario_creador FROM ventas WHERE id = %s",
            (venta_id,),
        )
        venta = cur.fetchone()
        cur.execute(
            """
            SELECT id_usuario
            FROM auditoria_eventos
            WHERE entidad = 'venta'
              AND entidad_id = %s
              AND accion = 'venta_creada'
            """,
            (venta_id,),
        )
        evento = cur.fetchone()

    assert venta["id_usuario_creador"] == actor_id
    assert evento["id_usuario"] == actor_id

    detalle_operador = client.get(
        f"/ventas/{venta_id}",
        headers=_headers(token),
    )
    assert detalle_operador.status_code == 200, detalle_operador.text
    assert detalle_operador.json()["items"][0]["costo_unitario_aplicado"] is None

    _, token_admin = _crear_actor(
        db_conn,
        username="admin_ve_costos",
        rol="administrador",
        permisos=("ver_rentabilidad",),
    )
    detalle_admin = client.get(
        f"/ventas/{venta_id}",
        headers=_headers(token_admin),
    )
    assert detalle_admin.status_code == 200, detalle_admin.text
    assert detalle_admin.json()["items"][0]["costo_unitario_aplicado"] is not None


def test_operador_no_puede_entregar_venta_con_deuda(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    _, token = _crear_actor(
        db_conn,
        username="operador_sin_deuda",
        rol="operador",
        permisos=("crear_venta",),
    )
    crear = client.post(
        "/ventas/",
        headers=_headers(token),
        json=_payload_venta(seed_venta_basica),
    )
    assert crear.status_code == 200, crear.text

    entregar = client.post(
        f"/ventas/{crear.json()['venta_id']}/entregar",
        headers=_headers(token),
        json={},
    )

    assert entregar.status_code == 403
    assert "entregar_con_deuda" in entregar.json()["detail"]


@pytest.mark.parametrize("rol", ["encargado", "administrador"])
def test_encargado_y_admin_pueden_entregar_con_deuda_formal(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
    rol,
):
    _, token = _crear_actor(
        db_conn,
        username=f"{rol}_venta_deuda",
        rol=rol,
        permisos=("crear_venta", "entregar_con_deuda", "generar_deuda"),
    )
    crear = client.post(
        "/ventas/",
        headers=_headers(token),
        json=_payload_venta(seed_venta_basica),
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    entregar = client.post(
        f"/ventas/{venta_id}/entregar",
        headers=_headers(token),
        json={},
    )
    assert entregar.status_code == 200, entregar.text

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT estado, saldo_actual
            FROM deudas_cliente
            WHERE origen_tipo = 'venta'
              AND origen_id = %s
            """,
            (venta_id,),
        )
        deuda = cur.fetchone()

    assert deuda is not None
    assert deuda["estado"] == "abierta"
    assert deuda["saldo_actual"] > 0


def test_operador_no_puede_anular_y_encargado_si(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    _, token_operador = _crear_actor(
        db_conn,
        username="operador_sin_anular",
        rol="operador",
        permisos=("crear_venta",),
    )
    crear = client.post(
        "/ventas/",
        headers=_headers(token_operador),
        json=_payload_venta(seed_venta_basica),
    )
    assert crear.status_code == 200, crear.text
    venta_id = crear.json()["venta_id"]

    bloqueado = client.post(
        f"/ventas/{venta_id}/anular",
        headers=_headers(token_operador),
        json={"motivo": "Intento operador"},
    )
    assert bloqueado.status_code == 403
    assert "anular_venta" in bloqueado.json()["detail"]

    _, token_encargado = _crear_actor(
        db_conn,
        username="encargado_anula",
        rol="encargado",
        permisos=("anular_venta",),
    )
    autorizado = client.post(
        f"/ventas/{venta_id}/anular",
        headers=_headers(token_encargado),
        json={"motivo": "Corrección autorizada"},
    )
    assert autorizado.status_code == 200, autorizado.text
    assert autorizado.json()["estado"] == "anulada"


def test_precio_manual_y_bonificacion_requieren_permiso(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    payload = _payload_venta(seed_venta_basica)
    payload["items"][0].update(
        {
            "precio_unitario_manual": 20000,
            "motivo_precio_manual": "Acuerdo comercial autorizado",
            "bonificado": True,
            "bonificacion_unitaria_manual": 1000,
            "motivo_bonificacion": "Atención comercial",
        }
    )

    _, token_operador = _crear_actor(
        db_conn,
        username="operador_sin_precio_manual",
        rol="operador",
        permisos=("crear_venta",),
    )
    bloqueado = client.post(
        "/ventas/",
        headers=_headers(token_operador),
        json=payload,
    )
    assert bloqueado.status_code == 403
    assert "modificar_precio_venta" in bloqueado.json()["detail"]

    _, token_encargado = _crear_actor(
        db_conn,
        username="encargado_precio_manual",
        rol="encargado",
        permisos=("crear_venta", "modificar_precio_venta"),
    )
    autorizado = client.post(
        "/ventas/",
        headers=_headers(token_encargado),
        json=payload,
    )
    assert autorizado.status_code == 200, autorizado.text


def test_pago_embebido_requiere_registrar_pago(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    payload = _payload_venta(
        seed_venta_basica,
        pagos=[
            {
                "medio_pago": "efectivo",
                "monto_base": seed_venta_basica["precio_venta"],
            }
        ],
    )

    _, token_sin_pago = _crear_actor(
        db_conn,
        username="mecanico_venta_sin_pago",
        rol="mecanico",
        permisos=("crear_venta",),
    )
    bloqueado = client.post(
        "/ventas/",
        headers=_headers(token_sin_pago),
        json=payload,
    )
    assert bloqueado.status_code == 403
    assert "registrar_pago" in bloqueado.json()["detail"]

    _, token_operador = _crear_actor(
        db_conn,
        username="operador_venta_con_pago",
        rol="operador",
        permisos=("crear_venta", "registrar_pago", "abrir_caja"),
    )
    abrir = client.post(
        "/cajas/abrir",
        headers=_headers(token_operador),
        json={"id_sucursal": seed_venta_basica["sucursal_id"], "monto_apertura": 0},
    )
    assert abrir.status_code == 200, abrir.text

    autorizado = client.post(
        "/ventas/",
        headers=_headers(token_operador),
        json=payload,
    )
    assert autorizado.status_code == 200, autorizado.text
    assert autorizado.json()["estado"] == "pagada_total"


def test_uso_credito_y_devoluciones_tienen_permiso_explicito(
    client,
    db_conn,
    seed_venta_basica,
    auth_habilitada,
):
    _, token_sin_credito = _crear_actor(
        db_conn,
        username="mecanico_sin_credito",
        rol="mecanico",
        permisos=("crear_venta",),
    )
    credito_bloqueado = client.post(
        "/ventas/",
        headers=_headers(token_sin_credito),
        json=_payload_venta(seed_venta_basica, usar_credito=True),
    )
    assert credito_bloqueado.status_code == 403
    assert "aplicar_credito_venta" in credito_bloqueado.json()["detail"]

    _, token_con_credito = _crear_actor(
        db_conn,
        username="operador_con_credito",
        rol="operador",
        permisos=("crear_venta", "aplicar_credito_venta"),
    )
    credito_autorizado = client.post(
        "/ventas/",
        headers=_headers(token_con_credito),
        json=_payload_venta(seed_venta_basica, usar_credito=True),
    )
    assert credito_autorizado.status_code == 200, credito_autorizado.text

    devolucion_bloqueada = client.post(
        "/ventas/999999/devolver",
        headers=_headers(token_sin_credito),
        json={"motivo": "Intento sin permiso"},
    )
    assert devolucion_bloqueada.status_code == 403
    assert "gestionar_devoluciones" in devolucion_bloqueada.json()["detail"]

    _, token_autorizado = _crear_actor(
        db_conn,
        username="encargado_devoluciones",
        rol="encargado",
        permisos=("gestionar_devoluciones",),
    )
    devolucion_autorizada = client.post(
        "/ventas/999999/devolver",
        headers=_headers(token_autorizado),
        json={"motivo": "Prueba autorizada"},
    )
    assert devolucion_autorizada.status_code == 404
