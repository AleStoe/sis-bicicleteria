import hashlib
import re
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from difflib import SequenceMatcher
from pathlib import Path

from fastapi import HTTPException
from psycopg.errors import UniqueViolation

from app.db.connection import get_connection
from app.modules.auditoria.service import registrar_evento
from app.modules.precios import repository as precios_repository
from app.modules.precios.motor import calcular_vista_previa_precios
from app.modules.documentos.pdf_lista_precios import generar_informe_lista_precios_pdf

from .lista_parser import ALLOWED_EXTENSIONS, parse_price_list
from . import listas_repository as repository


MAX_FILE_SIZE = 20 * 1024 * 1024
PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOADS_ROOT = PROJECT_ROOT / "uploads"
UPLOAD_DIR = UPLOADS_ROOT / "precios" / "listas"


def _detalle_lote(conn, lote_id: int):
    lote = repository.get_lote(conn, lote_id)
    if lote is None:
        raise HTTPException(status_code=404, detail="No existe el lote de precios")
    items = repository.get_lote_items(conn, lote_id)
    documento = {
        "id": lote["documento_id"],
        "nombre_original": lote["documento_nombre"],
        "ruta_relativa": lote["documento_ruta"],
        "mime_type": lote.get("mime_type"),
        "extension": lote["extension"],
        "tamano_bytes": lote["tamano_bytes"],
        "sha256": lote["sha256"],
        "extractor": lote["extractor"],
        "metadata_lectura": lote.get("metadata_lectura") or {},
    }
    result = dict(lote)
    result["documento"] = documento
    result["items"] = [dict(item) for item in items]
    result["resumen_coincidencias"] = dict(
        Counter(item.get("estado_coincidencia") or "pendiente" for item in items)
    )
    return result


def _plain_text(value) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", text.upper()).split())


def _exact_code(value) -> str:
    return str(value or "").strip().upper()


def _normalized_code(value) -> str:
    compact = re.sub(r"[^A-Z0-9]", "", _exact_code(value))
    if compact.isdigit():
        return compact.lstrip("0") or "0"
    return compact


def _description_score(source: str, target: str) -> float:
    left = _plain_text(source)
    right = _plain_text(target)
    if not left or not right:
        return 0
    sequence = SequenceMatcher(None, left, right).ratio()
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    token_score = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
    return max(sequence, token_score)


def _candidate(variante: dict, *, score: float, reason: str) -> dict:
    return {
        "id_variante": variante["id_variante"],
        "producto_nombre": variante["producto_nombre"],
        "variante_nombre": variante["nombre_variante"],
        "sku": variante.get("sku"),
        "ean": variante.get("codigo_barras"),
        "codigo_proveedor": variante.get("codigo_proveedor"),
        "confianza": round(score, 2),
        "motivo": reason,
    }


def _match_item(item: dict, catalog: list[dict], proveedor_id: int, repeated_codes: set[str]):
    code = _exact_code(item.get("codigo_original"))
    normalized = _normalized_code(code)
    description = item.get("descripcion_original") or ""

    if item.get("estado_coincidencia") == "descartada":
        return None
    if item.get("coincidencia_confirmada") and item.get("origen_coincidencia") == "manual":
        return None

    exact_matches = {}
    exact_reasons = {}
    alias_matches = {}
    if code:
        for variant in catalog:
            aliases_provider = {_exact_code(value) for value in variant.get("aliases_proveedor") or []}
            if code in aliases_provider:
                exact_matches[variant["id_variante"]] = variant
                exact_reasons[variant["id_variante"]] = "alias_proveedor"
                alias_matches[variant["id_variante"]] = variant
            if code == _exact_code(variant.get("sku")):
                exact_matches[variant["id_variante"]] = variant
                exact_reasons[variant["id_variante"]] = "sku"
            if code == _exact_code(variant.get("codigo_barras")):
                exact_matches[variant["id_variante"]] = variant
                exact_reasons[variant["id_variante"]] = "ean"
            if (
                variant.get("proveedor_preferido_id") == proveedor_id
                and code == _exact_code(variant.get("codigo_proveedor"))
            ):
                exact_matches[variant["id_variante"]] = variant
                exact_reasons[variant["id_variante"]] = "codigo_proveedor"

    if normalized and normalized in repeated_codes:
        candidates = [
            _candidate(variant, score=100, reason=exact_reasons[variant_id])
            for variant_id, variant in exact_matches.items()
        ]
        return {
            "codigo_normalizado": normalized,
            "estado_coincidencia": "ambigua",
            "id_variante": None,
            "origen_coincidencia": "codigo_repetido_lote",
            "confianza_coincidencia": None,
            "candidatos": candidates,
            "mensaje_coincidencia": "El código está repetido dentro de esta lista. Revisá las filas antes de vincular.",
            "coincidencia_confirmada": False,
        }

    if len(alias_matches) == 1:
        variant_id, variant = next(iter(alias_matches.items()))
        return {
            "codigo_normalizado": normalized or None,
            "estado_coincidencia": "exacta",
            "id_variante": variant_id,
            "origen_coincidencia": "alias_proveedor",
            "confianza_coincidencia": 100,
            "candidatos": [_candidate(variant, score=100, reason="alias_proveedor")],
            "mensaje_coincidencia": "Coincidencia exacta aprendida para este proveedor. Podés deshacerla.",
            "coincidencia_confirmada": False,
        }

    if len(exact_matches) == 1:
        variant_id, variant = next(iter(exact_matches.items()))
        reason = exact_reasons[variant_id]
        return {
            "codigo_normalizado": normalized or None,
            "estado_coincidencia": "exacta",
            "id_variante": variant_id,
            "origen_coincidencia": reason,
            "confianza_coincidencia": 100,
            "candidatos": [_candidate(variant, score=100, reason=reason)],
            "mensaje_coincidencia": "Coincidencia automática exacta. Podés deshacerla antes de aplicar la lista.",
            "coincidencia_confirmada": False,
        }
    if len(exact_matches) > 1:
        return {
            "codigo_normalizado": normalized or None,
            "estado_coincidencia": "ambigua",
            "id_variante": None,
            "origen_coincidencia": "multiples_exactas",
            "confianza_coincidencia": None,
            "candidatos": [
                _candidate(variant, score=100, reason=exact_reasons[variant_id])
                for variant_id, variant in exact_matches.items()
            ],
            "mensaje_coincidencia": "El código coincide exactamente con más de una variante. Elegí una manualmente.",
            "coincidencia_confirmada": False,
        }

    suggestions = {}
    for variant in catalog:
        variant_id = variant["id_variante"]
        code_values = [
            variant.get("sku"),
            variant.get("codigo_barras"),
            variant.get("codigo_proveedor"),
            *(variant.get("aliases") or []),
        ]
        normalized_values = {_normalized_code(value) for value in code_values if value}
        if normalized and normalized in normalized_values:
            suggestions[variant_id] = _candidate(
                variant,
                score=94,
                reason="codigo_normalizado",
            )
            continue
        score = _description_score(
            description,
            f"{variant['producto_nombre']} {variant['nombre_variante']}",
        )
        if score >= 0.58:
            suggestions[variant_id] = _candidate(
                variant,
                score=score * 100,
                reason="descripcion_similar",
            )

    candidates = sorted(
        suggestions.values(),
        key=lambda candidate: (-candidate["confianza"], candidate["id_variante"]),
    )[:5]
    if candidates:
        return {
            "codigo_normalizado": normalized or None,
            "estado_coincidencia": "sugerida",
            "id_variante": None,
            "origen_coincidencia": candidates[0]["motivo"],
            "confianza_coincidencia": candidates[0]["confianza"],
            "candidatos": candidates,
            "mensaje_coincidencia": "Encontré opciones parecidas. Ninguna se aplicará hasta que elijas una.",
            "coincidencia_confirmada": False,
        }
    return {
        "codigo_normalizado": normalized or None,
        "estado_coincidencia": "sin_coincidencia",
        "id_variante": None,
        "origen_coincidencia": None,
        "confianza_coincidencia": None,
        "candidatos": [],
        "mensaje_coincidencia": "No encontré un producto seguro. Buscalo manualmente o dejalo pendiente.",
        "coincidencia_confirmada": False,
    }


def importar_lista_precios(
    *,
    nombre_archivo: str,
    mime_type: str | None,
    contenido: bytes,
    proveedor_id: int,
    observaciones: str | None,
    usuario_id: int | None,
):
    extension = Path(nombre_archivo).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usá XLSX, CSV o TXT.")
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo está vacío")
    if len(contenido) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el máximo de 20 MB")

    sha256 = hashlib.sha256(contenido).hexdigest()
    conn = get_connection()
    saved_path = None
    try:
        duplicate = repository.get_documento_by_hash(conn, sha256)
        if duplicate is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "mensaje": "Este archivo ya fue cargado.",
                    "lote_id": duplicate["id_lote"],
                    "estado": duplicate["lote_estado"],
                },
            )
        proveedor = repository.get_proveedor_activo(conn, proveedor_id)
        if proveedor is None or not proveedor["activo"]:
            raise HTTPException(status_code=400, detail="El proveedor no existe o está inactivo")
        # Las lecturas anteriores abren una transaccion implicita en psycopg.
        # La cerramos antes de iniciar la escritura atomica del lote.
        conn.rollback()
        try:
            parsed = parse_price_list(nombre_archivo, contenido)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"No pude leer la lista: {exc}") from exc

        estado = (
            "requiere_revision"
            if any(item["estado"] == "incompleta" for item in parsed.filas)
            else "listo_para_revisar"
        )
        metadata = {
            "hoja": parsed.hoja,
            "fila_encabezado": parsed.fila_encabezado,
            "delimitador": parsed.delimitador,
            "codificacion": parsed.codificacion,
            "encabezados": parsed.encabezados,
            "mapeo": parsed.mapeo,
            "filas_detectadas": len(parsed.filas),
        }
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{sha256}{extension}"
        saved_path = UPLOAD_DIR / filename
        saved_path.write_bytes(contenido)
        relative_path = (Path("uploads") / saved_path.relative_to(UPLOADS_ROOT)).as_posix()

        with conn.transaction():
            lote_id = repository.insert_lote(
                conn,
                {
                    "id_proveedor": proveedor_id,
                    "proveedor_nombre_snapshot": proveedor["nombre"],
                    "estado": estado,
                    "nombre_archivo": nombre_archivo,
                    "formato": parsed.formato,
                    "hoja_detectada": parsed.hoja,
                    "fila_encabezado_detectada": parsed.fila_encabezado,
                    "delimitador_detectado": parsed.delimitador,
                    "codificacion_detectada": parsed.codificacion,
                    "encabezados": parsed.encabezados,
                    "mapeo_detectado": parsed.mapeo,
                    "total_filas": len(parsed.filas),
                    "observaciones": observaciones,
                    "id_usuario_creador": usuario_id,
                },
            )
            repository.insert_documento(
                conn,
                {
                    "id_lote": lote_id,
                    "nombre_original": nombre_archivo,
                    "nombre_guardado": filename,
                    "ruta_relativa": relative_path,
                    "mime_type": mime_type,
                    "extension": extension,
                    "tamano_bytes": len(contenido),
                    "sha256": sha256,
                    "extractor": parsed.extractor,
                    "metadata_lectura": metadata,
                },
            )
            repository.insert_items(conn, lote_id, parsed.filas)
            registrar_evento(
                conn,
                id_usuario=usuario_id,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_importada",
                detalle=f"Archivo {nombre_archivo} cargado como borrador",
                metadata={
                    "proveedor_id": proveedor_id,
                    "sha256": sha256,
                    "formato": parsed.formato,
                    "filas": len(parsed.filas),
                },
                origen_tipo="archivo_lista_precios",
                origen_id=lote_id,
            )
        return _detalle_lote(conn, lote_id)
    except Exception:
        if saved_path is not None and saved_path.exists():
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM precio_lista_documentos WHERE sha256 = %s",
                    (sha256,),
                )
                persisted = cur.fetchone() is not None
            if not persisted:
                saved_path.unlink(missing_ok=True)
        raise
    finally:
        conn.close()


def obtener_lote_precios(lote_id: int):
    conn = get_connection()
    try:
        return _detalle_lote(conn, lote_id)
    finally:
        conn.close()


def listar_lotes_precios(*, estado: str | None, proveedor_id: int | None, limit: int):
    conn = get_connection()
    try:
        return repository.list_lotes(
            conn,
            estado=estado,
            proveedor_id=proveedor_id,
            limit=limit,
        )
    finally:
        conn.close()


def anular_lote_precios(lote_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            lote = repository.get_lote(conn, lote_id)
            if lote is None:
                raise HTTPException(status_code=404, detail="No existe el lote de precios")
            if lote["estado"] == "anulado":
                raise HTTPException(status_code=409, detail="El lote ya está anulado")
            updated = repository.anular_lote(
                conn,
                lote_id,
                usuario_id=data.id_usuario,
                motivo=data.motivo,
            )
            if updated is None:
                raise HTTPException(status_code=409, detail="El lote ya no puede anularse")
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_anulada",
                detalle=data.motivo,
                metadata={"archivo_conservado": True},
                origen_tipo="archivo_lista_precios",
                origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def guardar_perfil_desde_lote(lote_id: int, data):
    conn = get_connection()
    try:
        try:
            with conn.transaction():
                lote = repository.get_lote(conn, lote_id)
                if lote is None:
                    raise HTTPException(status_code=404, detail="No existe el lote de precios")
                if lote["estado"] == "anulado":
                    raise HTTPException(status_code=409, detail="No se puede guardar el formato de un lote anulado")
                perfil = repository.insert_perfil_from_lote(
                    conn,
                    lote,
                    nombre=data.nombre,
                    usuario_id=data.id_usuario,
                )
                repository.attach_perfil(conn, lote_id, perfil["id"])
                registrar_evento(
                    conn,
                    id_usuario=data.id_usuario,
                    id_sucursal=None,
                    entidad="precio_lista_perfil",
                    entidad_id=perfil["id"],
                    accion="perfil_lista_precios_creado",
                    detalle=data.nombre,
                    metadata={"lote_id": lote_id, "proveedor_id": lote["id_proveedor"]},
                    origen_tipo="precio_lista_lote",
                    origen_id=lote_id,
                )
            perfil = dict(perfil)
            perfil["proveedor_nombre"] = lote["proveedor_nombre"]
            return perfil
        except UniqueViolation as exc:
            raise HTTPException(
                status_code=409,
                detail="Ya existe un formato con ese nombre para el proveedor",
            ) from exc
    finally:
        conn.close()


def listar_perfiles_precios(proveedor_id: int | None):
    conn = get_connection()
    try:
        return repository.list_perfiles(conn, proveedor_id)
    finally:
        conn.close()


def procesar_coincidencias_lote(lote_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            lote = repository.get_lote(conn, lote_id)
            if lote is None:
                raise HTTPException(status_code=404, detail="No existe el lote de precios")
            if lote["estado"] in {"anulado", "aplicado", "revertido"}:
                raise HTTPException(status_code=409, detail="El lote ya no admite cambios de coincidencias")
            items = [dict(item) for item in repository.get_lote_items(conn, lote_id)]
            catalog = [
                dict(row)
                for row in repository.list_catalogo_coincidencias(conn, lote["id_proveedor"])
            ]
            normalized_codes = [
                _normalized_code(item.get("codigo_original"))
                for item in items
                if item.get("codigo_original")
            ]
            repeated_codes = {
                code for code, count in Counter(normalized_codes).items() if code and count > 1
            }
            for item in items:
                match = _match_item(item, catalog, lote["id_proveedor"], repeated_codes)
                if match is not None:
                    repository.update_item_coincidencia(conn, item["id"], match)
            repository.touch_lote(conn, lote_id)
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_coincidencias_procesadas",
                detalle=f"Se analizaron {len(items)} fila(s) contra el catálogo.",
                metadata={"filas": len(items), "catalogo_variantes": len(catalog)},
                origen_tipo="precio_lista_lote",
                origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def vincular_item_lote(lote_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            item = repository.get_item_coincidencia(conn, lote_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe la fila del lote")
            if item["lote_estado"] in {"anulado", "aplicado", "revertido"}:
                raise HTTPException(status_code=409, detail="El lote ya no es editable")
            variant = repository.get_variante_activa(conn, data.id_variante)
            if variant is None:
                raise HTTPException(status_code=422, detail="La variante elegida no existe o está inactiva")

            code = _exact_code(item.get("codigo_original"))
            if data.recordar_alias and code:
                existing_alias = repository.get_alias_proveedor(
                    conn,
                    item["id_proveedor"],
                    code,
                )
                if (
                    existing_alias is not None
                    and existing_alias["id_variante"] != variant["id"]
                    and not data.reemplazar_alias
                ):
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Ese código ya está aprendido para otro producto. "
                            "Revisá ambos productos antes de reemplazar el alias."
                        ),
                    )
                repository.guardar_alias_proveedor(
                    conn,
                    item["id_proveedor"],
                    code,
                    variant["id"],
                    reemplazar=data.reemplazar_alias,
                )

            repository.update_item_coincidencia(
                conn,
                item_id,
                {
                    "codigo_normalizado": _normalized_code(code) or None,
                    "estado_coincidencia": "exacta",
                    "id_variante": variant["id"],
                    "origen_coincidencia": "manual",
                    "confianza_coincidencia": 100,
                    "candidatos": [
                        {
                            "id_variante": variant["id"],
                            "producto_nombre": variant["producto_nombre"],
                            "variante_nombre": variant["nombre_variante"],
                            "sku": variant.get("sku"),
                            "ean": variant.get("codigo_barras"),
                            "codigo_proveedor": variant.get("codigo_proveedor"),
                            "confianza": 100,
                            "motivo": "confirmacion_manual",
                        }
                    ],
                    "mensaje_coincidencia": (
                        "Vínculo confirmado y recordado para este proveedor."
                        if data.recordar_alias and code
                        else "Vínculo confirmado manualmente."
                    ),
                    "coincidencia_confirmada": True,
                    "id_usuario_confirmacion": data.id_usuario,
                    "confirmado_at": datetime.now(timezone.utc),
                },
            )
            repository.touch_lote(conn, lote_id)
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_item_vinculado",
                detalle=f"Fila #{item['numero_fila']} vinculada a {variant['producto_nombre']}.",
                metadata={
                    "item_id": item_id,
                    "id_variante": variant["id"],
                    "codigo_proveedor": code or None,
                    "alias_recordado": bool(data.recordar_alias and code),
                    "alias_reemplazado": data.reemplazar_alias,
                },
                origen_tipo="precio_lista_lote",
                origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def desvincular_item_lote(lote_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            item = repository.get_item_coincidencia(conn, lote_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe la fila del lote")
            if item["lote_estado"] in {"anulado", "aplicado", "revertido"}:
                raise HTTPException(status_code=409, detail="El lote ya no es editable")
            previous_variant = item.get("id_variante")
            repository.update_item_coincidencia(
                conn,
                item_id,
                {
                    "codigo_normalizado": item.get("codigo_normalizado"),
                    "estado_coincidencia": "descartada",
                    "id_variante": None,
                    "origen_coincidencia": "descartada_manual",
                    "confianza_coincidencia": None,
                    "candidatos": item.get("candidatos") or [],
                    "mensaje_coincidencia": data.motivo,
                    "coincidencia_confirmada": False,
                },
            )
            repository.touch_lote(conn, lote_id)
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_item_desvinculado",
                detalle=data.motivo,
                metadata={"item_id": item_id, "id_variante_anterior": previous_variant},
                origen_tipo="precio_lista_lote",
                origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def _parse_supplier_cost(value) -> Decimal | None:
    text = str(value or "").strip().replace("$", "").replace("\u00a0", "").replace(" ", "")
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return Decimal(text).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None


def _calculate_preview_item(
    conn,
    *,
    context: dict,
    provider_id: int,
    strategy_minor: str,
    strategy_wholesale: str,
    discount_minor: Decimal,
    discount_wholesale: Decimal,
    rounding_minor: Decimal,
    rounding_wholesale: Decimal,
    alert_pct: Decimal,
    manual_minor: Decimal | None = None,
    manual_wholesale: Decimal | None = None,
    selected: bool = True,
    confirm_free_price: bool = False,
):
    old_cost = Decimal(context.get("costo_reposicion") or context.get("costo_promedio_vigente") or 0)
    parsed_cost = _parse_supplier_cost(context.get("costo_original"))
    return calcular_vista_previa_precios(
        conn,
        context=context,
        provider_id=provider_id,
        old_cost=old_cost,
        new_cost=parsed_cost or Decimal("0"),
        current_minor=context.get("precio_minorista"),
        current_wholesale=context.get("precio_mayorista"),
        strategy_minor=strategy_minor,
        strategy_wholesale=strategy_wholesale,
        discount_minor=discount_minor,
        discount_wholesale=discount_wholesale,
        rounding_minor=rounding_minor,
        rounding_wholesale=rounding_wholesale,
        alert_pct=alert_pct,
        manual_minor=manual_minor,
        manual_wholesale=manual_wholesale,
        selected=selected,
        confirm_free_price=confirm_free_price,
        offer=context.get("oferta_snapshot"),
        free_price=bool(context.get("permite_precio_libre")),
    )

def _unmatched_preview(strategy: str, message: str):
    ignored = strategy == "ignorar"
    return {
        "costo_anterior": None, "costo_nuevo": None, "costo_variacion_pct": None,
        "precio_minorista_anterior": None, "precio_mayorista_anterior": None,
        "precio_minorista_nuevo": None, "precio_mayorista_nuevo": None,
        "margen_minorista_anterior": None, "margen_mayorista_anterior": None,
        "margen_minorista_nuevo": None, "margen_mayorista_nuevo": None,
        "estrategia_minorista": strategy, "estrategia_mayorista": strategy,
        "descuento_minorista": None, "descuento_mayorista": None,
        "redondeo_minorista": None, "redondeo_mayorista": None,
        "regla_minorista": None, "regla_mayorista": None, "oferta": None,
        "permite_precio_libre": False, "precio_libre_confirmado": False,
        "alertas": [] if ignored else [{"tipo": "bloqueo", "codigo": "sin_vinculo", "mensaje": message}],
        "explicacion": {"resultado": "fila ignorada" if ignored else "sin producto vinculado"},
        "seleccionado": not ignored, "valido": ignored,
    }


def generar_preview_lote(lote_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            lot = repository.get_lote_for_update(conn, lote_id)
            if lot is None:
                raise HTTPException(status_code=404, detail="No existe el lote de precios")
            if lot["estado"] in {"anulado", "aplicado", "revertido"}:
                raise HTTPException(status_code=409, detail="El lote ya no admite una vista previa")
            items = [dict(item) for item in repository.get_lote_items(conn, lote_id)]
            contexts = {row["id"]: dict(row) for row in repository.list_preview_contexts(conn, lote_id)}
            if not items:
                raise HTTPException(status_code=422, detail="El lote no tiene filas")

            valid_selected = True
            selected_count = 0
            for item in items:
                context = contexts.get(item["id"])
                if context is None or item.get("estado_coincidencia") != "exacta":
                    preview = _unmatched_preview(
                        data.estrategia,
                        "Resolvé la coincidencia del producto o marcá la fila como ignorada.",
                    )
                else:
                    preview = _calculate_preview_item(
                        conn,
                        context=context,
                        provider_id=lot["id_proveedor"],
                        strategy_minor=data.estrategia,
                        strategy_wholesale=data.estrategia,
                        discount_minor=Decimal(data.descuento_minorista_pct),
                        discount_wholesale=Decimal(data.descuento_mayorista_pct),
                        rounding_minor=Decimal(data.redondeo_minorista),
                        rounding_wholesale=Decimal(data.redondeo_mayorista),
                        alert_pct=Decimal(data.alerta_variacion_pct),
                        confirm_free_price=False,
                    )
                repository.update_item_preview(conn, item["id"], preview)
                if preview["seleccionado"]:
                    selected_count += 1
                    valid_selected = valid_selected and preview["valido"]

            state = "listo_para_aplicar" if selected_count > 0 and valid_selected else "requiere_revision"
            repository.update_lote_preview(
                conn,
                lote_id,
                {
                    "estado": state,
                    "estrategia": data.estrategia,
                    "alerta_variacion_pct": data.alerta_variacion_pct,
                    "descuento_minorista": data.descuento_minorista_pct,
                    "descuento_mayorista": data.descuento_mayorista_pct,
                    "redondeo_minorista": data.redondeo_minorista,
                    "redondeo_mayorista": data.redondeo_mayorista,
                },
            )
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_preview_generado",
                detalle=f"Vista previa generada para {len(items)} fila(s).",
                metadata={"estrategia": data.estrategia, "seleccionadas": selected_count, "estado": state},
                origen_tipo="precio_lista_lote",
                origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def actualizar_preview_item(lote_id: int, item_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            lot = repository.get_lote_for_update(conn, lote_id)
            if lot is None:
                raise HTTPException(status_code=404, detail="No existe el lote de precios")
            if lot["estado"] in {"anulado", "aplicado", "revertido"}:
                raise HTTPException(status_code=409, detail="El lote ya no es editable")
            if lot.get("preview_generado_at") is None:
                raise HTTPException(status_code=409, detail="Primero generá la vista previa general")
            item = repository.get_item_coincidencia(conn, lote_id, item_id)
            if item is None:
                raise HTTPException(status_code=404, detail="No existe la fila del lote")
            context = next(
                (dict(row) for row in repository.list_preview_contexts(conn, lote_id) if row["id"] == item_id),
                None,
            )
            both_ignored = data.estrategia_minorista == "ignorar" and data.estrategia_mayorista == "ignorar"
            if context is None:
                if not both_ignored:
                    raise HTTPException(status_code=409, detail="Vinculá el producto o ignorá ambos canales")
                preview = _unmatched_preview("ignorar", "Fila ignorada por el operador")
            else:
                preview = _calculate_preview_item(
                    conn,
                    context=context,
                    provider_id=lot["id_proveedor"],
                    strategy_minor=data.estrategia_minorista,
                    strategy_wholesale=data.estrategia_mayorista,
                    discount_minor=Decimal(lot["descuento_minorista_pct"]),
                    discount_wholesale=Decimal(lot["descuento_mayorista_pct"]),
                    rounding_minor=Decimal(lot["redondeo_minorista"]),
                    rounding_wholesale=Decimal(lot["redondeo_mayorista"]),
                    alert_pct=Decimal(lot["alerta_variacion_pct"]),
                    manual_minor=data.precio_minorista_manual,
                    manual_wholesale=data.precio_mayorista_manual,
                    selected=data.seleccionado_aplicar,
                    confirm_free_price=data.confirmar_precio_libre,
                )
            repository.update_item_preview(conn, item_id, preview)

            refreshed = repository.get_lote_items(conn, lote_id)
            selected_rows = [row for row in refreshed if row["seleccionado_aplicar"]]
            state = (
                "listo_para_aplicar"
                if selected_rows and all(row["preview_valido"] for row in selected_rows)
                else "requiere_revision"
            )
            repository.set_lote_estado(conn, lote_id, state)
            registrar_evento(
                conn,
                id_usuario=data.id_usuario,
                id_sucursal=None,
                entidad="precio_lista_lote",
                entidad_id=lote_id,
                accion="lista_precios_preview_item_actualizado",
                detalle=f"Vista previa ajustada en la fila #{item['numero_fila']}.",
                metadata={"item_id": item_id, "estado": state},
                origen_tipo="precio_lista_lote",
                origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def _decimal_or_none(value):
    return Decimal(str(value)) if value is not None else None


def _effective_variant_cost(variant: dict) -> Decimal:
    return Decimal(str(variant.get("costo_reposicion") or variant.get("costo_promedio_vigente") or 0))


def _application_conflicts(items: list[dict], variants: dict[int, dict]):
    conflicts = []
    seen = set()
    for item in items:
        variant_id = item.get("id_variante")
        if variant_id in seen:
            conflicts.append({"item_id": item["id"], "id_variante": variant_id, "motivo": "La variante aparece más de una vez en el lote."})
            continue
        seen.add(variant_id)
        variant = variants.get(variant_id)
        if variant is None:
            conflicts.append({"item_id": item["id"], "id_variante": variant_id, "motivo": "La variante ya no existe."})
            continue
        if not variant["activo"]:
            conflicts.append({"item_id": item["id"], "id_variante": variant_id, "motivo": "La variante está inactiva."})
            continue
        checks = (
            ("costo de reposición", _effective_variant_cost(variant), _decimal_or_none(item.get("costo_reposicion_anterior_snapshot"))),
            ("precio minorista", Decimal(str(variant["precio_minorista"])), _decimal_or_none(item.get("precio_minorista_anterior_snapshot"))),
            ("precio mayorista", Decimal(str(variant["precio_mayorista"])), _decimal_or_none(item.get("precio_mayorista_anterior_snapshot"))),
        )
        for label, current, expected in checks:
            if expected is None or current != expected:
                conflicts.append({
                    "item_id": item["id"], "id_variante": variant_id,
                    "motivo": f"Cambió el {label} desde la vista previa.",
                    "esperado": str(expected) if expected is not None else None,
                    "actual": str(current),
                })
    return conflicts


def aplicar_lote_precios(lote_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            lot = repository.get_lote_for_update(conn, lote_id)
            if lot is None:
                raise HTTPException(status_code=404, detail="No existe el lote de precios")
            if lot["estado"] == "aplicado":
                return _detalle_lote(conn, lote_id)
            if lot["estado"] == "revertido":
                raise HTTPException(status_code=409, detail="El lote ya fue aplicado y revertido")
            if lot["estado"] != "listo_para_aplicar":
                raise HTTPException(status_code=409, detail="La vista previa todavía tiene decisiones pendientes")
            if lot["preview_version"] != data.preview_version:
                raise HTTPException(status_code=409, detail="La vista previa cambió. Refrescá el lote antes de aplicarlo")

            items = [dict(row) for row in repository.list_selected_items_for_update(conn, lote_id)]
            if not items or not all(item.get("preview_valido") for item in items):
                raise HTTPException(status_code=409, detail="No hay filas válidas seleccionadas para aplicar")
            variant_rows = repository.lock_variants(conn, sorted({item["id_variante"] for item in items if item.get("id_variante")}))
            variants = {row["id"]: dict(row) for row in variant_rows}
            conflicts = _application_conflicts(items, variants)
            if conflicts:
                raise HTTPException(status_code=409, detail={"mensaje": "El catálogo cambió desde la vista previa. No se aplicó ningún precio.", "conflictos": conflicts})

            for item in items:
                variant = variants[item["id_variante"]]
                new_cost = Decimal(str(item["costo_reposicion_nuevo"]))
                new_retail = Decimal(str(item["precio_minorista_propuesto"]))
                new_wholesale = Decimal(str(item["precio_mayorista_propuesto"]))
                movement_id = precios_repository.insert_precio_movimiento(
                    conn,
                    {
                        "id_variante": item["id_variante"],
                        "precio_minorista_anterior": variant["precio_minorista"],
                        "precio_minorista_nuevo": new_retail,
                        "precio_mayorista_anterior": variant["precio_mayorista"],
                        "precio_mayorista_nuevo": new_wholesale,
                        "costo_anterior": _effective_variant_cost(variant),
                        "costo_nuevo": new_cost,
                        "tipo_movimiento": "actualizacion_por_lista_proveedor",
                        "motivo": f"Aplicación de lista {lot['nombre_archivo']}",
                        "origen_tipo": "precio_lista_lote",
                        "origen_id": lote_id,
                        "id_usuario": data.id_usuario,
                    },
                )
                repository.mark_item_applied(conn, item["id"], movement_id, variant)
                repository.update_variant_from_price_list(
                    conn,
                    item["id_variante"],
                    cost=new_cost,
                    retail_price=new_retail,
                    wholesale_price=new_wholesale,
                    currency=item.get("moneda_original") or "ARS",
                    cost_date=datetime.now(timezone.utc),
                    provider_id=lot["id_proveedor"],
                    cost_origin="lista_proveedor",
                )

            repository.mark_lot_applied(conn, lote_id, data.id_usuario, data.preview_version)
            registrar_evento(
                conn, id_usuario=data.id_usuario, id_sucursal=None,
                entidad="precio_lista_lote", entidad_id=lote_id,
                accion="lista_precios_aplicada",
                detalle=f"Se aplicaron {len(items)} producto(s) desde {lot['nombre_archivo']}.",
                metadata={"items_aplicados": len(items), "preview_version": data.preview_version},
                origen_tipo="precio_lista_lote", origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def revertir_lote_precios(lote_id: int, data):
    conn = get_connection()
    try:
        with conn.transaction():
            lot = repository.get_lote_for_update(conn, lote_id)
            if lot is None:
                raise HTTPException(status_code=404, detail="No existe el lote de precios")
            if lot["estado"] == "revertido":
                return _detalle_lote(conn, lote_id)
            if lot["estado"] != "aplicado":
                raise HTTPException(status_code=409, detail="Sólo se puede revertir un lote aplicado")

            items = [dict(row) for row in repository.list_selected_items_for_update(conn, lote_id)]
            variants = {row["id"]: dict(row) for row in repository.lock_variants(conn, sorted({item["id_variante"] for item in items}))}
            conflicts = []
            for item in items:
                variant = variants.get(item["id_variante"])
                latest_movement = repository.latest_price_movement_id(conn, item["id_variante"])
                if variant is None or latest_movement != item.get("precio_movimiento_aplicacion_id"):
                    conflicts.append({"item_id": item["id"], "id_variante": item["id_variante"], "motivo": "El producto tuvo movimientos posteriores a este lote."})
                    continue
                expected = (
                    (_effective_variant_cost(variant), _decimal_or_none(item.get("costo_reposicion_nuevo")), "costo"),
                    (Decimal(str(variant["precio_minorista"])), _decimal_or_none(item.get("precio_minorista_propuesto")), "precio minorista"),
                    (Decimal(str(variant["precio_mayorista"])), _decimal_or_none(item.get("precio_mayorista_propuesto")), "precio mayorista"),
                )
                for current, applied, label in expected:
                    if current != applied:
                        conflicts.append({"item_id": item["id"], "id_variante": item["id_variante"], "motivo": f"El {label} ya no coincide con el valor aplicado."})
            if conflicts:
                raise HTTPException(status_code=409, detail={"mensaje": "No se puede revertir: hay productos modificados después de este lote.", "conflictos": conflicts})

            for item in items:
                variant = variants[item["id_variante"]]
                previous_cost = item.get("costo_reposicion_previo_real")
                previous_retail = item["precio_minorista_anterior_snapshot"]
                previous_wholesale = item["precio_mayorista_anterior_snapshot"]
                movement_id = precios_repository.insert_precio_movimiento(
                    conn,
                    {
                        "id_variante": item["id_variante"],
                        "precio_minorista_anterior": variant["precio_minorista"],
                        "precio_minorista_nuevo": previous_retail,
                        "precio_mayorista_anterior": variant["precio_mayorista"],
                        "precio_mayorista_nuevo": previous_wholesale,
                        "costo_anterior": variant["costo_reposicion"],
                        "costo_nuevo": previous_cost,
                        "tipo_movimiento": "correccion_error",
                        "motivo": f"Reversión del lote #{lote_id}: {data.motivo}",
                        "origen_tipo": "reversion_precio_lista_lote",
                        "origen_id": lote_id,
                        "id_usuario": data.id_usuario,
                    },
                )
                repository.update_variant_from_price_list(
                    conn,
                    item["id_variante"],
                    cost=previous_cost,
                    retail_price=previous_retail,
                    wholesale_price=previous_wholesale,
                    currency=item.get("costo_reposicion_moneda_previa") or "ARS",
                    cost_date=item.get("costo_reposicion_fecha_previa"),
                    provider_id=item.get("costo_reposicion_proveedor_previo_id"),
                    cost_origin=item.get("costo_reposicion_origen_previo"),
                )
                repository.mark_item_reverted(conn, item["id"], movement_id)

            repository.mark_lot_reverted(conn, lote_id, data.id_usuario, data.motivo)
            registrar_evento(
                conn, id_usuario=data.id_usuario, id_sucursal=None,
                entidad="precio_lista_lote", entidad_id=lote_id,
                accion="lista_precios_revertida",
                detalle=data.motivo,
                metadata={"items_revertidos": len(items)},
                origen_tipo="precio_lista_lote", origen_id=lote_id,
            )
        return obtener_lote_precios(lote_id)
    finally:
        conn.close()


def generar_informe_lote_precios(lote_id: int):
    detail = obtener_lote_precios(lote_id)
    if detail["estado"] not in {"aplicado", "revertido"}:
        raise HTTPException(status_code=409, detail="El informe final está disponible después de aplicar el lote")
    return generar_informe_lista_precios_pdf(detail)
