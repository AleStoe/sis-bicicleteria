from fastapi import Depends, HTTPException

from app.core.security import CurrentUser, obtener_usuario_actual
from app.shared.constants import (
    PERMISO_AJUSTAR_CAJA,
    PERMISO_AJUSTAR_STOCK,
    PERMISO_ANULAR_VENTA,
    PERMISO_CANCELAR_RESERVA,
    PERMISO_CERRAR_CAJA,
    PERMISO_ENTREGAR_CON_DEUDA,
    PERMISO_GENERAR_DEUDA,
    PERMISO_REINTEGRAR_CREDITO,
    PERMISO_REVERTIR_PAGO,
    ROL_ADMINISTRADOR,
)
from . import repository


def usuario_tiene_rol(conn, id_usuario: int, rol_nombre: str) -> bool:
    roles = repository.get_roles_usuario(conn, id_usuario)
    nombres = {r["nombre"] for r in roles}
    return rol_nombre in nombres


def _forbidden(nombre_permiso: str):
    raise HTTPException(
        status_code=403,
        detail=f"No tenés permisos para realizar esta acción: {nombre_permiso}",
    )


def exigir_rol_admin(conn, id_usuario: int):
    if not usuario_tiene_rol(conn, id_usuario, ROL_ADMINISTRADOR):
        _forbidden("rol_administrador")


def exigir_permiso(conn, id_usuario: int, permiso: str):
    if repository.usuario_tiene_permiso(conn, id_usuario, permiso):
        return

    _forbidden(permiso)


def exigir_permiso_actual(usuario: CurrentUser, permiso: str):
    if usuario.auth_disabled or "*" in usuario.permisos:
        return

    if permiso not in usuario.permisos:
        _forbidden(permiso)


def requerir_permiso(permiso: str):
    def dependency(
        usuario: CurrentUser = Depends(obtener_usuario_actual),
    ) -> CurrentUser:
        exigir_permiso_actual(usuario, permiso)
        return usuario

    return dependency


def exigir_permiso_anular_venta(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_ANULAR_VENTA)


def exigir_permiso_entregar_con_deuda(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_ENTREGAR_CON_DEUDA)


def exigir_permiso_revertir_pago(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_REVERTIR_PAGO)


def exigir_permiso_ajustar_stock(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_AJUSTAR_STOCK)


def exigir_permiso_cerrar_caja(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_CERRAR_CAJA)


def exigir_permiso_ajustar_caja(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_AJUSTAR_CAJA)


def exigir_permiso_cancelar_reserva(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_CANCELAR_RESERVA)


def exigir_permiso_generar_deuda(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_GENERAR_DEUDA)


def exigir_permiso_reintegrar_credito(conn, id_usuario: int):
    exigir_permiso(conn, id_usuario, PERMISO_REINTEGRAR_CREDITO)
