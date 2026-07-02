import os
import re
import shutil
import subprocess
import threading
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from app.core.config import BASE_DIR, settings
from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.shared.constants import (
    AUDITORIA_ACCION_BACKUP_DESCARGADO,
    AUDITORIA_ACCION_BACKUP_GENERADO,
    AUDITORIA_ENTIDAD_BACKUP,
)


BACKUPS_DIR = BASE_DIR / "backups"
UPLOADS_DIR = BASE_DIR / "uploads"
BACKUP_NAME_RE = re.compile(
    r"^backup-emprendimiento-agus-\d{8}-\d{4}\.(dump|zip)$"
)
BACKUP_LOCK = threading.Lock()
PG_DUMP_TIMEOUT_SECONDS = 600


def listar_backups():
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backups = [
        _archivo_a_output(path)
        for path in BACKUPS_DIR.iterdir()
        if path.is_file() and not path.is_symlink() and _nombre_valido(path.name)
    ]
    return sorted(backups, key=lambda item: item["fecha"], reverse=True)


def generar_backup(*, incluir_uploads: bool, id_usuario: int):
    if not BACKUP_LOCK.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail="Ya hay un backup en proceso. Esperá a que termine.",
        )

    try:
        return _generar_backup_bloqueado(
            incluir_uploads=incluir_uploads,
            id_usuario=id_usuario,
        )
    finally:
        BACKUP_LOCK.release()


def preparar_descarga(nombre: str, *, id_usuario: int):
    path = _resolver_backup_existente(nombre)
    info = _archivo_a_output(path)
    _registrar_auditoria(
        id_usuario=id_usuario,
        accion=AUDITORIA_ACCION_BACKUP_DESCARGADO,
        detalle=f"Backup descargado: {path.name}",
        metadata=_metadata_backup(info),
    )
    return path, info


def _generar_backup_bloqueado(*, incluir_uploads: bool, id_usuario: int):
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    extension = "zip" if incluir_uploads else "dump"
    nombre = f"backup-emprendimiento-agus-{timestamp}.{extension}"
    destino = BACKUPS_DIR / nombre

    if destino.exists():
        raise HTTPException(
            status_code=409,
            detail=(
                "Ya existe un backup de este tipo generado en el mismo minuto. "
                "Esperá un minuto antes de volver a intentarlo."
            ),
        )

    pg_dump = _resolver_pg_dump()
    temporal = BACKUPS_DIR / f".backup-{uuid.uuid4().hex}"
    temporal.mkdir(parents=False, exist_ok=False)
    dump_temporal = temporal / "database.dump"

    try:
        _ejecutar_pg_dump(pg_dump, dump_temporal)
        if incluir_uploads:
            _crear_zip(destino, dump_temporal)
        else:
            dump_temporal.replace(destino)

        info = _archivo_a_output(destino)
        try:
            _registrar_auditoria(
                id_usuario=id_usuario,
                accion=AUDITORIA_ACCION_BACKUP_GENERADO,
                detalle=f"Backup generado: {destino.name}",
                metadata=_metadata_backup(info),
            )
        except Exception:
            destino.unlink(missing_ok=True)
            raise

        return info
    except Exception:
        destino.unlink(missing_ok=True)
        raise
    finally:
        shutil.rmtree(temporal, ignore_errors=True)


def _resolver_pg_dump() -> Path:
    encontrado = shutil.which("pg_dump")
    if encontrado:
        return Path(encontrado)

    postgres_root = Path("C:/Program Files/PostgreSQL")
    if postgres_root.exists():
        candidatos = sorted(
            postgres_root.glob("*/bin/pg_dump.exe"),
            key=lambda path: path.parent.parent.name,
            reverse=True,
        )
        if candidatos:
            return candidatos[0]

    raise HTTPException(
        status_code=503,
        detail=(
            "No se encontró pg_dump. Instalá las herramientas de PostgreSQL "
            "o agregá su carpeta bin al PATH del servidor."
        ),
    )


def _ejecutar_pg_dump(pg_dump: Path, destino: Path):
    comando = [
        str(pg_dump),
        "-h",
        settings.db_host,
        "-p",
        str(settings.db_port),
        "-U",
        settings.db_user,
        "-F",
        "c",
        "--no-owner",
        "--no-privileges",
        "--no-password",
        "-f",
        str(destino),
        settings.db_name,
    ]
    entorno = os.environ.copy()
    entorno["PGPASSWORD"] = settings.db_password
    opciones = {
        "env": entorno,
        "capture_output": True,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
        "timeout": PG_DUMP_TIMEOUT_SECONDS,
        "check": False,
    }
    if os.name == "nt":
        opciones["creationflags"] = subprocess.CREATE_NO_WINDOW

    try:
        resultado = subprocess.run(comando, **opciones)
    except subprocess.TimeoutExpired as exc:
        destino.unlink(missing_ok=True)
        raise HTTPException(
            status_code=504,
            detail="El backup excedió el tiempo máximo de 10 minutos.",
        ) from exc
    except OSError as exc:
        destino.unlink(missing_ok=True)
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo ejecutar pg_dump: {exc}",
        ) from exc

    if resultado.returncode != 0 or not destino.exists():
        destino.unlink(missing_ok=True)
        detalle = _detalle_pg_dump(resultado.stderr)
        raise HTTPException(
            status_code=503,
            detail=f"pg_dump no pudo generar el backup. {detalle}",
        )


def _detalle_pg_dump(stderr: str | None) -> str:
    texto = " ".join(str(stderr or "").strip().split())
    if settings.db_password:
        texto = texto.replace(settings.db_password, "***")
    if not texto:
        return "Verificá que PostgreSQL esté disponible y que la conexión sea válida."
    return texto[-500:]


def _crear_zip(destino: Path, dump_path: Path):
    with zipfile.ZipFile(
        destino,
        mode="x",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=6,
    ) as archivo:
        archivo.write(dump_path, arcname="database.dump")
        if UPLOADS_DIR.exists():
            for path in sorted(UPLOADS_DIR.rglob("*")):
                if path.is_file() and not path.is_symlink():
                    relative = path.relative_to(UPLOADS_DIR)
                    archivo.write(path, arcname=str(Path("uploads") / relative))


def _resolver_backup_existente(nombre: str) -> Path:
    if not _nombre_valido(nombre):
        raise HTTPException(status_code=400, detail="Nombre de backup inválido")

    root = BACKUPS_DIR.resolve()
    path = (root / nombre).resolve()
    if path.parent != root:
        raise HTTPException(status_code=400, detail="Nombre de backup inválido")
    if not path.exists() or not path.is_file() or path.is_symlink():
        raise HTTPException(status_code=404, detail="El backup solicitado no existe")
    return path


def _nombre_valido(nombre: str) -> bool:
    return bool(BACKUP_NAME_RE.fullmatch(str(nombre or "")))


def _archivo_a_output(path: Path):
    stat = path.stat()
    incluye_uploads = path.suffix.lower() == ".zip"
    return {
        "nombre": path.name,
        "tipo": "base_datos_y_uploads" if incluye_uploads else "base_datos",
        "incluye_uploads": incluye_uploads,
        "tamano_bytes": stat.st_size,
        "fecha": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
    }


def _metadata_backup(info: dict):
    return {
        "nombre": info["nombre"],
        "tipo": info["tipo"],
        "incluye_uploads": info["incluye_uploads"],
        "tamano_bytes": info["tamano_bytes"],
    }


def _registrar_auditoria(
    *,
    id_usuario: int,
    accion: str,
    detalle: str,
    metadata: dict,
):
    conn = get_connection()
    try:
        with conn.transaction():
            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario,
                id_sucursal=None,
                entidad=AUDITORIA_ENTIDAD_BACKUP,
                entidad_id=0,
                accion=accion,
                detalle=detalle,
                metadata=metadata,
            )
    finally:
        conn.close()
