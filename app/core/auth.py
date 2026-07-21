import base64
import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl, urlencode

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.security import cargar_usuario_actual


AUTH_EXEMPT_PATHS = {
    "/auth/login",
    "/auth/status",
    "/health",
    "/openapi.json",
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
}

ACTOR_USER_FIELDS = {
    "id_usuario",
    "id_usuario_creador",
    "id_usuario_cierre",
    "id_usuario_apertura",
}
ACTOR_ROOT_FIELDS = {
    "id_usuario",
    "id_usuario_creador",
}


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


def _json_dumps(data: dict[str, Any]) -> bytes:
    return json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")


def crear_token_usuario(usuario: dict[str, Any]) -> str:
    now = int(time.time())
    payload = {
        "sub": int(usuario["id"]),
        "username": usuario["username"],
        "rol": usuario.get("rol"),
        "iat": now,
        "exp": now + settings.auth_token_minutes * 60,
    }
    header = {"alg": "HS256", "typ": "JWT"}

    signing_input = f"{_b64encode(_json_dumps(header))}.{_b64encode(_json_dumps(payload))}"
    signature = hmac.new(
        settings.app_secret.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()

    return f"{signing_input}.{_b64encode(signature)}"


def verificar_token_usuario(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    signing_input = f"{header_b64}.{payload_b64}"
    expected_signature = hmac.new(
        settings.app_secret.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()

    try:
        received_signature = _b64decode(signature_b64)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    if not hmac.compare_digest(expected_signature, received_signature):
        raise HTTPException(status_code=401, detail="Token inválido")

    try:
        payload = json.loads(_b64decode(payload_b64))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Sesión expirada")

    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Token inválido")

    return payload


def obtener_usuario_token_desde_header(authorization: str | None) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida")

    return verificar_token_usuario(authorization.removeprefix("Bearer ").strip())


async def auth_middleware(request: Request, call_next):
    if settings.auth_disabled or request.method == "OPTIONS" or _is_exempt_path(request.url.path):
        return await call_next(request)

    try:
        token_payload = _obtener_usuario_request(request)
        current_user = cargar_usuario_actual(token_payload)
        request.state.usuario = token_payload
        request.state.current_user = current_user

        body = await request.body()
        body = _sobrescribir_actor_request(request, current_user.id, body)
        _reinyectar_body(request, body)
    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    return await call_next(request)


def _obtener_usuario_request(request: Request) -> dict[str, Any]:
    authorization = request.headers.get("Authorization")
    if authorization:
        return obtener_usuario_token_desde_header(authorization)

    if (
        request.url.path.startswith("/documentos/")
        or request.url.path in {
            "/catalogo/pdf/mayorista",
            "/catalogo/pdf/bicicletas",
            "/catalogo/pdf/minorista",
        }
    ):
        token = request.query_params.get("access_token")
        if token:
            return verificar_token_usuario(token)

    return obtener_usuario_token_desde_header(None)


def _is_exempt_path(path: str) -> bool:
    if path in AUTH_EXEMPT_PATHS:
        return True

    return path.startswith("/uploads/")


def _sobrescribir_actor_request(
    request: Request,
    usuario_id: int,
    body: bytes,
) -> bytes:
    _sobrescribir_actor_query(request, usuario_id)

    if not body:
        return body

    content_type = request.headers.get("content-type", "")
    if "application/json" not in content_type:
        return body

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return body

    modificado = _inyectar_actor_raiz(data, usuario_id)
    modificado = _sobrescribir_actor_values(data, usuario_id) or modificado
    if not modificado:
        return body

    nuevo_body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )
    _actualizar_content_length(request, len(nuevo_body))
    return nuevo_body


def _sobrescribir_actor_values(data: Any, usuario_id: int) -> bool:
    modificado = False

    if isinstance(data, dict):
        for key, value in data.items():
            if key in ACTOR_USER_FIELDS:
                if value != usuario_id:
                    data[key] = usuario_id
                    modificado = True
            else:
                modificado = (
                    _sobrescribir_actor_values(value, usuario_id) or modificado
                )
    elif isinstance(data, list):
        for item in data:
            modificado = _sobrescribir_actor_values(item, usuario_id) or modificado

    return modificado


def _inyectar_actor_raiz(data: Any, usuario_id: int) -> bool:
    if not isinstance(data, dict):
        return False

    modificado = False
    for field in ACTOR_ROOT_FIELDS:
        if field not in data:
            data[field] = usuario_id
            modificado = True

    return modificado


def _sobrescribir_actor_query(request: Request, usuario_id: int):
    query_string = request.scope.get("query_string", b"")
    pares = parse_qsl(query_string.decode("utf-8"), keep_blank_values=True)
    nuevos_pares = [
        (key, str(usuario_id) if key in ACTOR_USER_FIELDS else value)
        for key, value in pares
    ]
    claves = {key for key, _ in nuevos_pares}
    if "id_usuario" not in claves:
        nuevos_pares.append(("id_usuario", str(usuario_id)))

    request.scope["query_string"] = urlencode(nuevos_pares, doseq=True).encode("utf-8")


def _actualizar_content_length(request: Request, body_length: int):
    headers = [
        (key, value)
        for key, value in request.scope.get("headers", [])
        if key.lower() != b"content-length"
    ]
    headers.append((b"content-length", str(body_length).encode("ascii")))
    request.scope["headers"] = headers


def _reinyectar_body(request: Request, body: bytes):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request._body = body
    request._receive = receive
