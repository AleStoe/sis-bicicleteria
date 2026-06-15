import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import HTTPException, Request, status
from starlette.responses import JSONResponse

from app.core.config import settings


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
        usuario = obtener_usuario_token_desde_header(request.headers.get("Authorization"))
        request.state.usuario = usuario

        body = await request.body()
        _validar_actor_request(request, usuario, body)
        _reinyectar_body(request, body)
    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    return await call_next(request)


def _is_exempt_path(path: str) -> bool:
    if path in AUTH_EXEMPT_PATHS:
        return True

    return path.startswith("/uploads/")


def _validar_actor_request(request: Request, usuario: dict[str, Any], body: bytes):
    usuario_id = int(usuario["sub"])

    for field in ACTOR_USER_FIELDS:
        value = request.query_params.get(field)
        if value is not None:
            _validar_actor_value(field, value, usuario_id)

    if not body:
        return

    content_type = request.headers.get("content-type", "")
    if "application/json" not in content_type:
        return

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return

    for field, value in _iter_actor_values(data):
        _validar_actor_value(field, value, usuario_id)


def _iter_actor_values(data: Any):
    if isinstance(data, dict):
        for key, value in data.items():
            if key in ACTOR_USER_FIELDS and value is not None:
                yield key, value
            else:
                yield from _iter_actor_values(value)
    elif isinstance(data, list):
        for item in data:
            yield from _iter_actor_values(item)


def _validar_actor_value(field: str, value: Any, usuario_id: int):
    try:
        value_int = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} inválido",
        ) from exc

    if value_int != usuario_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario de la operación no coincide con la sesión",
        )


def _reinyectar_body(request: Request, body: bytes):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request._receive = receive
