from pathlib import Path
from types import SimpleNamespace
import zipfile

import pytest

from app.core.auth import crear_token_usuario
from app.core.config import settings
from app.modules.backups import service as backup_service
from app.modules.usuarios.service import hash_password
from tests.conftest import asignar_rol_usuario


def _headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def _crear_actor(db_conn, *, username: str, rol: str):
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
                f"{username}@test.local",
                hash_password("Password123"),
            ),
        )
        usuario_id = cur.fetchone()["id"]

    asignar_rol_usuario(db_conn, usuario_id, rol)
    db_conn.commit()
    token = crear_token_usuario(
        {
            "id": usuario_id,
            "username": username,
            "rol": rol,
        }
    )
    return usuario_id, token


def _asegurar_permiso_admin(db_conn):
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO permisos (codigo, descripcion)
            VALUES (
                'gestionar_backups',
                'Generar, listar y descargar backups del sistema'
            )
            ON CONFLICT (codigo) DO NOTHING
            """
        )
        cur.execute(
            """
            INSERT INTO rol_permisos (id_rol, id_permiso)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permisos p
            WHERE r.nombre = 'administrador'
              AND p.codigo = 'gestionar_backups'
            ON CONFLICT (id_rol, id_permiso) DO NOTHING
            """
        )
    db_conn.commit()


def _configurar_entorno_backup(monkeypatch, tmp_path):
    backups_dir = tmp_path / "backups"
    uploads_dir = tmp_path / "uploads"
    uploads_dir.mkdir()
    monkeypatch.setattr(backup_service, "BACKUPS_DIR", backups_dir)
    monkeypatch.setattr(backup_service, "UPLOADS_DIR", uploads_dir)
    monkeypatch.setattr(
        backup_service,
        "_resolver_pg_dump",
        lambda: Path("pg_dump-test"),
    )

    def fake_run(command, **_options):
        destino = Path(command[command.index("-f") + 1])
        destino.write_bytes(b"PGDMP-test")
        return SimpleNamespace(returncode=0, stderr="", stdout="")

    monkeypatch.setattr(backup_service.subprocess, "run", fake_run)
    return backups_dir, uploads_dir


@pytest.fixture()
def auth_habilitada(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)


def test_usuario_no_admin_no_puede_listar_backups(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _asegurar_permiso_admin(db_conn)
    _, token = _crear_actor(
        db_conn,
        username="operador_sin_backups",
        rol="operador",
    )

    response = client.get("/backups/", headers=_headers(token))

    assert response.status_code == 403
    assert "gestionar_backups" in response.json()["detail"]


def test_permiso_aislado_no_habilita_backups_a_un_no_admin(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
):
    _asegurar_permiso_admin(db_conn)
    usuario_id, token = _crear_actor(
        db_conn,
        username="encargado_con_permiso_backup",
        rol="encargado",
    )
    with db_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO rol_permisos (id_rol, id_permiso)
            SELECT ur.id_rol, p.id
            FROM usuario_roles ur
            CROSS JOIN permisos p
            WHERE ur.id_usuario = %s
              AND p.codigo = 'gestionar_backups'
            ON CONFLICT (id_rol, id_permiso) DO NOTHING
            """,
            (usuario_id,),
        )
    db_conn.commit()

    response = client.get("/backups/", headers=_headers(token))

    assert response.status_code == 403
    assert "Sólo un administrador" in response.json()["detail"]


def test_admin_genera_lista_y_audita_backup(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    monkeypatch,
    tmp_path,
):
    _asegurar_permiso_admin(db_conn)
    admin_id, token = _crear_actor(
        db_conn,
        username="admin_backups",
        rol="administrador",
    )
    backups_dir, _uploads_dir = _configurar_entorno_backup(monkeypatch, tmp_path)

    generar = client.post(
        "/backups/",
        headers=_headers(token),
        json={"incluir_uploads": False},
    )

    assert generar.status_code == 201, generar.text
    data = generar.json()
    assert data["nombre"].startswith("backup-emprendimiento-agus-")
    assert data["nombre"].endswith(".dump")
    assert data["tipo"] == "base_datos"
    assert (backups_dir / data["nombre"]).read_bytes() == b"PGDMP-test"

    listado = client.get("/backups/", headers=_headers(token))
    assert listado.status_code == 200, listado.text
    assert [item["nombre"] for item in listado.json()] == [data["nombre"]]

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_usuario, accion, metadata
            FROM auditoria_eventos
            WHERE entidad = 'backup'
            ORDER BY id DESC
            LIMIT 1
            """
        )
        evento = cur.fetchone()

    assert evento["id_usuario"] == admin_id
    assert evento["accion"] == "backup_generado"
    assert evento["metadata"]["nombre"] == data["nombre"]


def test_backup_zip_incluye_dump_y_uploads(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    monkeypatch,
    tmp_path,
):
    _asegurar_permiso_admin(db_conn)
    _, token = _crear_actor(
        db_conn,
        username="admin_backup_zip",
        rol="administrador",
    )
    backups_dir, uploads_dir = _configurar_entorno_backup(monkeypatch, tmp_path)
    (uploads_dir / "productos").mkdir()
    (uploads_dir / "productos" / "foto.jpg").write_bytes(b"imagen-test")

    response = client.post(
        "/backups/",
        headers=_headers(token),
        json={"incluir_uploads": True},
    )

    assert response.status_code == 201, response.text
    path = backups_dir / response.json()["nombre"]
    assert path.suffix == ".zip"
    with zipfile.ZipFile(path) as archivo:
        assert set(archivo.namelist()) == {
            "database.dump",
            "uploads/productos/foto.jpg",
        }


def test_descarga_backup_requiere_sesion_y_audita(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    monkeypatch,
    tmp_path,
):
    _asegurar_permiso_admin(db_conn)
    admin_id, token = _crear_actor(
        db_conn,
        username="admin_descarga_backup",
        rol="administrador",
    )
    backups_dir, _uploads_dir = _configurar_entorno_backup(monkeypatch, tmp_path)
    backups_dir.mkdir()
    nombre = "backup-emprendimiento-agus-20260701-1200.dump"
    (backups_dir / nombre).write_bytes(b"PGDMP-download")

    sin_sesion = client.get(f"/backups/{nombre}/descargar")
    assert sin_sesion.status_code == 401

    descarga = client.get(
        f"/backups/{nombre}/descargar",
        headers=_headers(token),
    )
    assert descarga.status_code == 200, descarga.text
    assert descarga.content == b"PGDMP-download"

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id_usuario, accion
            FROM auditoria_eventos
            WHERE entidad = 'backup'
            ORDER BY id DESC
            LIMIT 1
            """
        )
        evento = cur.fetchone()

    assert evento == {
        "id_usuario": admin_id,
        "accion": "backup_descargado",
    }


def test_error_claro_si_pg_dump_no_esta_disponible(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    monkeypatch,
    tmp_path,
):
    from fastapi import HTTPException

    _asegurar_permiso_admin(db_conn)
    _, token = _crear_actor(
        db_conn,
        username="admin_sin_pg_dump",
        rol="administrador",
    )
    monkeypatch.setattr(backup_service, "BACKUPS_DIR", tmp_path / "backups")

    def no_disponible():
        raise HTTPException(status_code=503, detail="No se encontró pg_dump.")

    monkeypatch.setattr(backup_service, "_resolver_pg_dump", no_disponible)

    response = client.post(
        "/backups/",
        headers=_headers(token),
        json={"incluir_uploads": False},
    )

    assert response.status_code == 503
    assert "pg_dump" in response.json()["detail"]


def test_error_de_conexion_no_expone_password(
    client,
    db_conn,
    clean_db,
    auth_habilitada,
    monkeypatch,
    tmp_path,
):
    _asegurar_permiso_admin(db_conn)
    _, token = _crear_actor(
        db_conn,
        username="admin_db_caida",
        rol="administrador",
    )
    monkeypatch.setattr(backup_service, "BACKUPS_DIR", tmp_path / "backups")
    monkeypatch.setattr(
        backup_service,
        "_resolver_pg_dump",
        lambda: Path("pg_dump-test"),
    )

    def falla_conexion(_command, **_options):
        return SimpleNamespace(
            returncode=1,
            stdout="",
            stderr=(
                f"password={settings.db_password} "
                "connection to server failed: Connection refused"
            ),
        )

    monkeypatch.setattr(backup_service.subprocess, "run", falla_conexion)

    response = client.post(
        "/backups/",
        headers=_headers(token),
        json={"incluir_uploads": False},
    )

    assert response.status_code == 503
    assert "Connection refused" in response.json()["detail"]
    assert settings.db_password not in response.json()["detail"]
    assert "***" in response.json()["detail"]
