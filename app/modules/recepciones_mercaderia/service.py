import hashlib
import re
import unicodedata
from collections import Counter
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from psycopg.errors import CheckViolation, ForeignKeyViolation, UniqueViolation

from app.db.connection import get_connection
from app.modules.auditoria import service as auditoria_service
from app.modules.catalogo import repository as catalogo_repository
from app.modules.precios import repository as precios_repository
from app.modules.precios.service import _calcular_precio_desde_regla
from app.modules.stock.service import registrar_ingreso_stock

from . import repository
from .document_parser import ALLOWED_EXTENSIONS, DocumentExtraction, extraer_documento


ESTADOS_RECEPCION = {
    "borrador",
    "procesando",
    "requiere_revision",
    "lista_para_confirmar",
    "confirmada",
    "anulada",
    "error",
}

MAX_DOCUMENT_SIZE = 15 * 1024 * 1024
UPLOADS_RECEPCIONES_DIR = Path(__file__).resolve().parents[3] / "uploads" / "recepciones"
UPLOADS_RECEPCIONES_IMAGES_DIR = Path(__file__).resolve().parents[3] / "uploads" / "catalogo" / "recepciones"
IMAGEN_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024

REGLAS_ALTA = (
    (("PORTAPQTE", "PORTAPAQUETE", "PORTA PAQUETE"), "ACCESORIOS", "ACCESORIOS", "PORTAPAQUETE"),
    (("PORTACAR", "CARAM", "BOTELLA"), "ACCESORIOS", "CARAMAÑOLA Y PORTACARAMAÑOLA", "CARAMAÑOLA / PORTA"),
    (("COLLAR", "ABRAZADERA"), "REPUESTOS", "ASIENTOS Y PORTASILLAS", "ABRAZADERA DE ASIENTO"),
    (("LLANTA",), "REPUESTOS", "LLANTAS", "LLANTA"),
    (("CUB", "CUBIERTA", "MAXXIS"), "REPUESTOS", "CUBIERTAS", "CUBIERTA BICICLETA"),
    (("RDA", "RUEDA"), "REPUESTOS", "RUEDAS ARMADAS", "RUEDA ARMADA"),
    (("MT200", "CALIPER", "FRENO"), "REPUESTOS", "FRENOS", "FRENO"),
    (("PINON",), "REPUESTOS", "TRANSMISION", "PIÑÓN"),
    (("PUNO", "GRIP"), "REPUESTOS", "PUÑOS Y CINTAS", "PUÑO"),
    (("GAFA", "LENTE"), "ACCESORIOS", "GAFAS", "GAFAS"),
    (("PISTOLA", "HERRAMIENTA", "EXTRACTOR", "LLAVE"), "HERRAMIENTAS", "HERRAMIENTAS", "HERRAMIENTA"),
    (("VALV", "TUBELESS"), "REPUESTOS", "CUBIERTAS", "CUBIERTA BICICLETA"),
    (("SOPORTE",), "ACCESORIOS", "ACCESORIOS", "COMPUTADORA"),
    (("CAMARA",), "REPUESTOS", "CAMARAS", "CÁMARA"),
    (("MAZA",), "REPUESTOS", "MAZAS", "MAZA"),
    (("CADENA",), "REPUESTOS", "TRANSMISION", "CADENA"),
    (("ASIENTO", "SILLIN"), "REPUESTOS", "ASIENTOS Y PORTASILLAS", "ASIENTO"),
)


def _normalizar_texto(value: str) -> str:
    texto = unicodedata.normalize("NFKD", str(value or ""))
    texto = "".join(char for char in texto if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", texto).strip().upper()


def _decimal_argentino(value: str) -> Decimal:
    texto = str(value or "").strip().replace("$", "").replace("\u00a0", "").replace(" ", "")
    if not texto:
        raise InvalidOperation

    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif texto.count(".") > 1:
        texto = texto.replace(".", "")

    return Decimal(texto)


def _es_encabezado(celdas: list[str]) -> bool:
    texto = _normalizar_texto(" ".join(celdas))
    return (
        "CODIGO" in texto
        and ("PRODUCTO" in texto or "DESCRIPCION" in texto)
        and ("CANT" in texto or "CANTIDAD" in texto)
    )


def _es_separador_markdown(linea: str) -> bool:
    limpio = linea.replace("|", "").replace(":", "").replace("-", "").strip()
    return not limpio


def _separar_linea(linea: str) -> list[str] | None:
    if "|" in linea:
        celdas = [celda.strip() for celda in linea.strip().strip("|").split("|")]
    elif "\t" in linea:
        celdas = [celda.strip() for celda in linea.split("\t")]
    elif ";" in linea:
        celdas = [celda.strip() for celda in linea.split(";")]
    else:
        match = re.match(
            r"^\s*(\S+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\$?\s*[\d.]+(?:,\d+)?|\$?\s*\d+(?:\.\d+)?)\s*$",
            linea,
        )
        if not match:
            return None
        celdas = list(match.groups())

    celdas = [celda for celda in celdas if celda != ""]
    if len(celdas) < 4:
        return None
    if len(celdas) > 4:
        celdas = [celdas[0], " ".join(celdas[1:-2]), celdas[-2], celdas[-1]]
    return celdas


def parsear_tabla(texto: str) -> list[dict]:
    items = []
    for numero_linea, original in enumerate(str(texto or "").splitlines(), start=1):
        linea = original.strip()
        if not linea or _es_separador_markdown(linea):
            continue

        celdas = _separar_linea(linea)
        if celdas and _es_encabezado(celdas):
            continue

        item = {
            "numero_linea": numero_linea,
            "linea_original": original,
            "codigo_proveedor": None,
            "descripcion_original": None,
            "descripcion_normalizada": None,
            "cantidad": None,
            "costo_unitario": None,
            "costo_total": None,
            "total_linea_documental": None,
            "estado_resolucion": "incompleta",
            "id_variante": None,
            "mensaje_revision": None,
            "nombre_propuesto": None,
            "nombre_variante_propuesta": None,
            "rubro_propuesto": None,
            "id_categoria_propuesta": None,
            "id_marca_propuesta": None,
            "subtipo_propuesto": None,
            "sku_propuesto": None,
            "confianza_sugerencia": None,
            "descuento_linea_pct": Decimal("0"),
        }

        if not celdas:
            item["mensaje_revision"] = "No pude separar codigo, producto, cantidad y costo."
            items.append(item)
            continue

        codigo, descripcion, cantidad_raw, costo_raw = celdas[:4]
        item["codigo_proveedor"] = codigo.strip()
        item["descripcion_original"] = descripcion.strip()
        item["descripcion_normalizada"] = _normalizar_texto(descripcion)

        try:
            cantidad = _decimal_argentino(cantidad_raw)
            costo = _decimal_argentino(costo_raw)
            if cantidad <= 0:
                raise ValueError("La cantidad debe ser mayor a cero.")
            if costo < 0:
                raise ValueError("El costo no puede ser negativo.")
            item["cantidad"] = cantidad.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
            item["costo_unitario"] = costo.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            item["costo_total"] = (cantidad * costo).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        except (InvalidOperation, ValueError) as exc:
            item["mensaje_revision"] = str(exc) or "Cantidad o costo invalido."

        if not item["codigo_proveedor"] or not item["descripcion_original"]:
            item["mensaje_revision"] = "Codigo y descripcion son obligatorios."

        items.append(item)

    if not items:
        raise HTTPException(
            status_code=422,
            detail="No encontre filas de productos. Pegá codigo, descripcion, cantidad y costo.",
        )
    return items


def _items_desde_filas_extraidas(
    filas: list[dict], *, origen_extraccion: str = "estructurado"
) -> list[dict]:
    items = []
    for index, fila in enumerate(filas, start=1):
        linea = "\t".join(
            str(fila.get(key, "") if fila.get(key) is not None else "")
            for key in ("codigo", "descripcion", "cantidad", "costo_unitario")
        )
        parsed = parsear_tabla(linea)[0]
        parsed["numero_linea"] = int(fila.get("numero_linea") or index)
        parsed["linea_original"] = linea
        parsed["descuento_linea_pct"] = Decimal(str(fila.get("descuento_linea_pct") or 0))
        total_linea_documental = fila.get("total_linea_documental")
        parsed["total_linea_documental"] = (
            _decimal_argentino(total_linea_documental).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if total_linea_documental not in (None, "")
            else None
        )
        if parsed["total_linea_documental"] is not None:
            parsed["costo_total"] = parsed["total_linea_documental"]
        confianzas = fila.get("confianza_campos") or {}
        parsed.update(
            origen_extraccion=origen_extraccion,
            confianza_codigo=confianzas.get("codigo"),
            confianza_descripcion=confianzas.get("descripcion"),
            confianza_cantidad=confianzas.get("cantidad"),
            confianza_costo=confianzas.get("costo"),
            lectura_confirmada=origen_extraccion != "ocr",
        )
        items.append(parsed)
    return items


def _confianza_promedio(items: list[dict]) -> Decimal | None:
    valores = []
    for item in items:
        for campo in ("confianza_codigo", "confianza_descripcion", "confianza_cantidad", "confianza_costo"):
            if item.get(campo) is not None:
                valores.append(Decimal(str(item[campo])))
    if not valores:
        return None
    return (sum(valores, Decimal("0")) / len(valores)).quantize(Decimal("0.0001"))


def _sugerir_alta(item: dict, referencia: dict) -> None:
    descripcion = _normalizar_texto(item.get("descripcion_original"))
    categorias = {
        _normalizar_texto(categoria["nombre"]): categoria
        for categoria in referencia["categorias"]
    }
    rubros = {_normalizar_texto(rubro): rubro for rubro in referencia["rubros"]}

    item["nombre_propuesto"] = re.sub(
        r"\s+", " ", str(item.get("descripcion_original") or "")
    ).strip().upper()
    item["nombre_variante_propuesta"] = "UNICA"
    item["sku_propuesto"] = "AUTOMATICO"

    for palabras, rubro, categoria, subtipo in REGLAS_ALTA:
        if any(palabra in descripcion for palabra in palabras):
            categoria_db = categorias.get(_normalizar_texto(categoria))
            rubro_db = rubros.get(_normalizar_texto(rubro))
            if rubro_db:
                item["rubro_propuesto"] = rubro_db
            if categoria_db:
                item["id_categoria_propuesta"] = categoria_db["id"]
            if categoria_db and rubro_db:
                item["subtipo_propuesto"] = subtipo
                item["confianza_sugerencia"] = "media"
            break

PALABRAS_DESCRIPTIVAS_IGNORADAS = {
    "DE", "DEL", "LA", "EL", "LOS", "LAS", "PARA", "CON", "SIN", "Y",
    "UN", "UNA", "BICICLETA", "PRODUCTO", "IMPORTADO", "IMPORTADA",
}


def _tokens_descripcion(value: str) -> set[str]:
    return {
        token for token in re.findall(r"[A-Z0-9]+", _normalizar_texto(value))
        if len(token) > 1 and token not in PALABRAS_DESCRIPTIVAS_IGNORADAS
    }


def _similitud_descripcion(a: str, b: str) -> Decimal:
    tokens_a = _tokens_descripcion(a)
    tokens_b = _tokens_descripcion(b)
    if not tokens_a or not tokens_b:
        return Decimal("0")
    return Decimal(len(tokens_a & tokens_b)) / Decimal(len(tokens_a | tokens_b))


def _aplicar_alerta_costo(item: dict, variante: dict | None, costo_nuevo=None) -> None:
    if not variante:
        return
    costo_anterior = Decimal(variante.get("costo_promedio_vigente") or 0)
    costo_nuevo = Decimal(costo_nuevo if costo_nuevo is not None else item.get("costo_unitario") or 0)
    if costo_anterior <= 0 or costo_nuevo <= 0:
        return
    variacion = ((costo_nuevo - costo_anterior) / costo_anterior * Decimal("100")).quantize(Decimal("0.01"))
    item["variacion_costo_pct"] = variacion
    if variacion <= Decimal("-30"):
        item["alerta_costo"] = f"El costo bajó {abs(variacion):.2f}%. Revisión obligatoria; no se reducirá el precio automáticamente."
    elif variacion <= Decimal("-10"):
        item["alerta_costo"] = f"El costo bajó {abs(variacion):.2f}%. Se conservará el precio vigente hasta revisarlo."
    elif variacion >= Decimal("30"):
        item["alerta_costo"] = f"El costo aumentó {variacion:.2f}%. Revisión obligatoria por variación extrema."
    elif variacion >= Decimal("10"):
        item["alerta_costo"] = f"El costo aumentó {variacion:.2f}% respecto del costo vigente."


def _aplicar_memoria_y_duplicados(item: dict, memorias: list[dict], candidatos: list[dict]) -> None:
    descripcion = item.get("descripcion_normalizada") or item.get("descripcion_original") or ""
    mejor_memoria = None
    mejor_memoria_score = Decimal("0")
    for memoria in memorias:
        score = _similitud_descripcion(descripcion, memoria["descripcion_normalizada"])
        if score > mejor_memoria_score:
            mejor_memoria, mejor_memoria_score = memoria, score

    if mejor_memoria and mejor_memoria_score >= Decimal("0.72"):
        item.update(
            rubro_propuesto=mejor_memoria.get("rubro"),
            id_categoria_propuesta=mejor_memoria.get("id_categoria"),
            subtipo_propuesto=mejor_memoria.get("subtipo"),
            confianza_sugerencia="alta" if mejor_memoria_score >= Decimal("0.90") else "media",
            origen_resolucion="memoria_sugerida",
            id_memoria_clasificacion=mejor_memoria["id"],
            mensaje_revision=(
                f"Clasificación sugerida por {mejor_memoria['confirmaciones']} confirmación(es) anterior(es). Revisala antes de crear."
            ),
        )

    similares = []
    for candidato in candidatos:
        texto_candidato = f"{candidato['producto_nombre']} {candidato['nombre_variante']}"
        score = _similitud_descripcion(descripcion, texto_candidato)
        if score >= Decimal("0.82"):
            similares.append(
                {
                    "id_variante": candidato["id_variante"],
                    "producto": candidato["producto_nombre"],
                    "variante": candidato["nombre_variante"],
                    "similitud": float(score.quantize(Decimal("0.01"))),
                }
            )
    similares.sort(key=lambda row: row["similitud"], reverse=True)
    if similares:
        item["posible_duplicado"] = True
        item["duplicado_candidatos"] = similares[:3]
        item["mensaje_revision"] = (
            f"Posible duplicado de {similares[0]['producto']}. Compará antes de crear una variante nueva."
        )


def _aplicar_regla_clasificacion_aprobada(item: dict, reglas: list[dict]) -> None:
    if item.get("id_memoria_clasificacion"):
        return
    descripcion = item.get("descripcion_normalizada") or item.get("descripcion_original") or ""
    mejor = None
    mejor_score = Decimal("0")
    for regla in reglas:
        patron = (regla.get("payload") or {}).get("descripcion_normalizada")
        if not patron:
            continue
        score = _similitud_descripcion(descripcion, patron)
        if score > mejor_score:
            mejor, mejor_score = regla, score
    if mejor is None or mejor_score < Decimal("0.72"):
        return
    payload = mejor.get("payload") or {}
    item.update(
        rubro_propuesto=payload.get("rubro") or item.get("rubro_propuesto"),
        id_categoria_propuesta=payload.get("id_categoria") or item.get("id_categoria_propuesta"),
        subtipo_propuesto=payload.get("subtipo") or item.get("subtipo_propuesto"),
        confianza_sugerencia="alta" if mejor_score >= Decimal("0.90") else "media",
        origen_resolucion="descripcion_sugerida",
        mensaje_revision=f"Clasificación sugerida por la regla aprobada '{mejor['titulo']}'. Revisala antes de crear.",
    )


def _resolver_items(conn, items: list[dict], proveedor_id: int) -> list[dict]:
    referencia = repository.get_catalogo_referencia(conn)
    memorias = repository.list_memorias_clasificacion(conn)
    reglas_aprobadas = repository.list_reglas_clasificacion_aceptadas(conn, proveedor_id)
    candidatos = repository.list_catalogo_candidatos(conn)
    codigos = [
        _normalizar_texto(item.get("codigo_proveedor"))
        for item in items
        if item.get("codigo_proveedor")
    ]
    repetidos = {codigo for codigo, total in Counter(codigos).items() if total > 1}

    for item in items:
        if item["mensaje_revision"]:
            continue

        codigo = _normalizar_texto(item["codigo_proveedor"])
        if codigo in repetidos:
            item["estado_resolucion"] = "conflicto"
            item["mensaje_revision"] = "El codigo esta repetido dentro de esta recepcion."
            continue

        coincidencias = repository.buscar_variantes_por_codigo(
            conn, item["codigo_proveedor"], proveedor_id
        )
        exactas_proveedor = [
            variante
            for variante in coincidencias
            if variante["proveedor_preferido_id"] == proveedor_id
            or variante["codigo_proveedor_vinculado"]
        ]

        if len(exactas_proveedor) == 1:
            item["estado_resolucion"] = "exacta"
            item["id_variante"] = exactas_proveedor[0]["id"]
            item["origen_resolucion"] = "codigo_proveedor"
            _aplicar_alerta_costo(item, exactas_proveedor[0])
        elif len(exactas_proveedor) > 1 or len(coincidencias) > 1:
            item["estado_resolucion"] = "conflicto"
            item["mensaje_revision"] = "El codigo coincide con varias variantes."
        else:
            coincidencias_ean = (
                repository.buscar_variante_por_ean(conn, codigo)
                if codigo.isdigit() and len(codigo) in {8, 12, 13, 14}
                else []
            )
            if len(coincidencias_ean) == 1:
                variante_ean = coincidencias_ean[0]
                item["estado_resolucion"] = "exacta"
                item["id_variante"] = variante_ean["id"]
                item["origen_resolucion"] = "ean"
                item["mensaje_revision"] = "Coincidencia automática por EAN. Podés deshacerla antes de confirmar."
                variante_costo = repository.get_variante_activa(conn, variante_ean["id"])
                _aplicar_alerta_costo(item, variante_costo)
            elif len(coincidencias_ean) > 1:
                item["estado_resolucion"] = "conflicto"
                item["mensaje_revision"] = "El EAN coincide con varias variantes. Revisá el catálogo."
            elif len(coincidencias) == 1:
                item["estado_resolucion"] = "sugerida"
                item["id_variante"] = coincidencias[0]["id"]
                item["origen_resolucion"] = "codigo_otro_proveedor"
                item["mensaje_revision"] = (
                    "El código existe, pero está asociado a otro proveedor o no tiene proveedor preferido."
                )
            else:
                item["estado_resolucion"] = "nueva"
                _sugerir_alta(item, referencia)
                item["mensaje_revision"] = "Producto nuevo: revisá y confirmá su ficha propuesta."
                _aplicar_memoria_y_duplicados(item, memorias, candidatos)
                _aplicar_regla_clasificacion_aprobada(item, reglas_aprobadas)

    return items


def _detalle(conn, recepcion_id: int):
    recepcion = repository.get_recepcion(conn, recepcion_id)
    if recepcion is None:
        raise HTTPException(status_code=404, detail=f"No existe la recepcion {recepcion_id}")
    costos = repository.get_costos(conn, recepcion_id)
    return {
        **dict(recepcion),
        "items": repository.list_items(conn, recepcion_id),
        "costos": dict(costos) if costos else None,
        "documentos": repository.list_documentos(conn, recepcion_id),
        "aprendizaje": repository.get_aprendizaje_recepcion(conn, recepcion_id),
    }


def importar_tabla(data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            proveedor = repository.get_proveedor(conn, payload["id_proveedor"])
            if proveedor is None or not proveedor["activo"]:
                raise HTTPException(status_code=404, detail="Proveedor inexistente o inactivo")
            sucursal = repository.get_sucursal(conn, payload["id_sucursal"])
            if sucursal is None or not sucursal["activa"]:
                raise HTTPException(status_code=404, detail="Sucursal inexistente o inactiva")

            items = _resolver_items(
                conn,
                parsear_tabla(payload["texto"]),
                payload["id_proveedor"],
            )
            total_unidades = sum((item["cantidad"] or Decimal("0")) for item in items)
            total_costo = sum((item["costo_total"] or Decimal("0")) for item in items)
            requiere_revision = any(
                item["estado_resolucion"] != "exacta" for item in items
            )
            recepcion = repository.insert_recepcion(
                conn,
                {
                    **payload,
                    "proveedor_nombre_snapshot": proveedor["nombre"],
                    "texto_origen": payload["texto"],
                    "estado": "requiere_revision" if requiere_revision else "lista_para_confirmar",
                    "total_lineas": len(items),
                    "total_unidades": total_unidades,
                    "total_costo": total_costo,
                },
            )
            for item in items:
                repository.insert_item(conn, recepcion["id"], item)
            repository.recalcular_metricas_aprendizaje(conn, recepcion["id"])

            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=payload["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion["id"],
                accion="recepcion_borrador_importado",
                detalle=(
                    f"Recepcion #{recepcion['id']} importada para {proveedor['nombre']}: "
                    f"{len(items)} linea(s)."
                ),
                metadata={
                    "total_lineas": len(items),
                    "total_unidades": str(total_unidades),
                    "total_costo": str(total_costo),
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion["id"],
            )
        return _detalle(conn, recepcion["id"])
    finally:
        conn.close()


def importar_documento(
    *,
    nombre_archivo: str,
    mime_type: str | None,
    contenido: bytes,
    id_proveedor: int,
    id_sucursal: int,
    observaciones: str | None,
    id_usuario: int | None,
    recepcion_id: int | None = None,
):
    nombre_archivo = Path(nombre_archivo or "documento").name
    extension = Path(nombre_archivo).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Formato no admitido. Usá PDF, Excel, CSV, TXT, JPG, PNG o WEBP.",
        )
    if not contenido:
        raise HTTPException(status_code=422, detail="El archivo está vacío.")
    if len(contenido) > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=413, detail="El archivo supera el máximo de 15 MB.")

    sha256 = hashlib.sha256(contenido).hexdigest()
    conn = get_connection()
    destino = None
    archivo_creado = False
    try:
        with conn.transaction():
            duplicado = repository.get_documento_by_hash(conn, sha256)
            if duplicado:
                raise HTTPException(
                    status_code=409,
                    detail=f"Este documento ya fue cargado en la recepción #{duplicado['recepcion_id']}.",
                )

        try:
            extraccion = extraer_documento(nombre_archivo, contenido)
        except Exception as exc:
            extraccion = DocumentExtraction(
                estado="error",
                extractor="error_lectura",
                error=f"No pude leer el archivo: {exc}",
            )

        tipo_documento = extraccion.metadata.get("tipo_documento", "documento")
        items = []
        if extraccion.filas and tipo_documento != "nota_credito":
            items = _items_desde_filas_extraidas(
                extraccion.filas,
                origen_extraccion="ocr" if extraccion.extractor.startswith("rapidocr") else "estructurado",
            )
        elif (
            extraccion.texto
            and extension in {".csv", ".txt"}
            and tipo_documento != "nota_credito"
        ):
            try:
                items = parsear_tabla(extraccion.texto)
            except HTTPException:
                extraccion.estado = "requiere_revision"
                extraccion.error = "Pude leer el archivo, pero no reconocer sus columnas."

        UPLOADS_RECEPCIONES_DIR.mkdir(parents=True, exist_ok=True)
        nombre_guardado = f"{sha256}{extension}"
        destino = UPLOADS_RECEPCIONES_DIR / nombre_guardado
        archivo_creado = not destino.exists()
        if archivo_creado:
            destino.write_bytes(contenido)

        with conn.transaction():
            proveedor = repository.get_proveedor(conn, id_proveedor)
            if proveedor is None or not proveedor["activo"]:
                raise HTTPException(status_code=404, detail="Proveedor inexistente o inactivo")
            sucursal = repository.get_sucursal(conn, id_sucursal)
            if sucursal is None or not sucursal["activa"]:
                raise HTTPException(status_code=404, detail="Sucursal inexistente o inactiva")

            recepcion_existente = None
            if recepcion_id is not None:
                recepcion_existente = repository.get_recepcion(conn, recepcion_id)
                if recepcion_existente is None:
                    raise HTTPException(status_code=404, detail="No existe la recepción indicada")
                if recepcion_existente["estado"] in {"confirmada", "anulada"}:
                    raise HTTPException(status_code=409, detail="La recepción ya no admite documentos")
                if (
                    recepcion_existente["id_proveedor"] != id_proveedor
                    or recepcion_existente["id_sucursal"] != id_sucursal
                ):
                    raise HTTPException(
                        status_code=409,
                        detail="El documento debe pertenecer al mismo proveedor y sucursal.",
                    )

            if items:
                items = _resolver_items(conn, items, id_proveedor)
                if extraccion.extractor.startswith("rapidocr"):
                    for item in items:
                        if item["estado_resolucion"] == "exacta":
                            item["estado_resolucion"] = "sugerida"
                            item["mensaje_revision"] = (
                                "El OCR encontró este vínculo. Confirmá la lectura antes de ingresar stock."
                            )
            if recepcion_existente is None:
                total_unidades = sum((item["cantidad"] or Decimal("0")) for item in items)
                total_costo = sum((item["costo_total"] or Decimal("0")) for item in items)
                resuelta = bool(items) and all(item["estado_resolucion"] == "exacta" for item in items)
                recepcion = repository.insert_recepcion(
                    conn,
                    {
                        "id_proveedor": id_proveedor,
                        "proveedor_nombre_snapshot": proveedor["nombre"],
                        "id_sucursal": id_sucursal,
                        "estado": "lista_para_confirmar" if resuelta else "requiere_revision",
                        "origen_carga": "xlsx" if extension == ".xlsx" else "documento",
                        "texto_origen": extraccion.texto,
                        "observaciones": observaciones,
                        "total_lineas": len(items),
                        "total_unidades": total_unidades,
                        "total_costo": total_costo,
                        "id_usuario": id_usuario,
                    },
                )
                for item in items:
                    repository.insert_item(conn, recepcion["id"], item)
            else:
                recepcion = recepcion_existente
                existentes = repository.list_items(conn, recepcion["id"])
                if items and not existentes:
                    for item in items:
                        repository.insert_item(conn, recepcion["id"], item)
                    repository.recalcular_cabecera(conn, recepcion["id"])
                elif extraccion.filas:
                    actuales_por_codigo = {
                        _normalizar_texto(item.get("codigo_proveedor")): item
                        for item in existentes if item.get("codigo_proveedor")
                    }
                    documento_por_codigo = {
                        _normalizar_texto(fila.get("codigo")): fila
                        for fila in extraccion.filas if fila.get("codigo")
                    }
                    codigos_actuales = set(actuales_por_codigo)
                    codigos_documento = set(documento_por_codigo)
                    diferencias = []
                    for codigo in sorted(codigos_actuales & codigos_documento):
                        actual = actuales_por_codigo[codigo]
                        fila = documento_por_codigo[codigo]
                        cantidad_documento = _decimal_argentino(fila.get("cantidad"))
                        costo_documento = _decimal_argentino(fila.get("costo_unitario"))
                        if (
                            cantidad_documento != actual.get("cantidad")
                            or costo_documento != actual.get("costo_unitario")
                        ):
                            diferencias.append(
                                {
                                    "codigo": codigo,
                                    "cantidad_recepcion": str(actual.get("cantidad")),
                                    "cantidad_documento": str(cantidad_documento),
                                    "costo_recepcion": str(actual.get("costo_unitario")),
                                    "costo_documento": str(costo_documento),
                                }
                            )
                    extraccion.metadata["comparacion_recepcion"] = {
                        "coincidencias": len(codigos_actuales & codigos_documento),
                        "solo_recepcion": sorted(codigos_actuales - codigos_documento),
                        "solo_documento": sorted(codigos_documento - codigos_actuales),
                        "diferencias": diferencias,
                    }
                repository.marcar_requiere_revision(conn, recepcion["id"])
            repository.insert_documento(
                conn,
                {
                    "id_recepcion": recepcion["id"],
                    "nombre_original": nombre_archivo,
                    "nombre_guardado": nombre_guardado,
                    "ruta_relativa": f"recepciones/{nombre_guardado}",
                    "mime_type": mime_type,
                    "extension": extension,
                    "tamano_bytes": len(contenido),
                    "sha256": sha256,
                    "estado": extraccion.estado,
                    "extractor": extraccion.extractor,
                    "texto_extraido": extraccion.texto or None,
                    "metadata_extraida": extraccion.metadata,
                    "error_extraccion": extraccion.error,
                    "tipo_documento": tipo_documento,
                    "numero_documento": extraccion.metadata.get("numero_documento"),
                },
            )
            repository.registrar_formato_proveedor(
                conn,
                {
                    "id_proveedor": id_proveedor,
                    "tipo_documento": tipo_documento,
                    "extension": extension,
                    "extractor": extraccion.extractor,
                    "estado": extraccion.estado,
                    "confianza_promedio": _confianza_promedio(items),
                },
            )
            repository.recalcular_metricas_aprendizaje(conn, recepcion["id"])
            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario or recepcion.get("id_usuario_creador"),
                id_sucursal=id_sucursal,
                entidad="recepcion_mercaderia",
                entidad_id=recepcion["id"],
                accion="recepcion_documento_importado",
                detalle=f"Documento {nombre_archivo} cargado en recepción #{recepcion['id']}.",
                metadata={
                    "sha256": sha256,
                    "extractor": extraccion.extractor,
                    "estado_extraccion": extraccion.estado,
                    "total_lineas": len(items),
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion["id"],
            )
        return _detalle(conn, recepcion["id"])
    except UniqueViolation as exc:
        if archivo_creado and destino is not None:
            destino.unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail="Este documento ya fue cargado.") from exc
    except Exception:
        if archivo_creado and destino is not None:
            destino.unlink(missing_ok=True)
        raise
    finally:
        conn.close()


def reprocesar_documento(
    documento_id: int,
    *,
    id_usuario: int | None,
    reemplazar_lineas: bool = False,
):
    conn = get_connection()
    try:
        with conn.transaction():
            documento = repository.get_documento(conn, documento_id)
            if documento is None:
                raise HTTPException(status_code=404, detail="No existe el documento")
            if documento["recepcion_estado"] in {"confirmada", "anulada"}:
                raise HTTPException(status_code=409, detail="La recepción ya no admite reprocesos")

        uploads_root = UPLOADS_RECEPCIONES_DIR.parent.resolve()
        archivo = (uploads_root / documento["ruta_relativa"]).resolve()
        if not archivo.is_relative_to(uploads_root) or not archivo.exists():
            raise HTTPException(status_code=404, detail="No encontré el archivo original guardado")

        try:
            extraccion = extraer_documento(documento["nombre_original"], archivo.read_bytes())
        except Exception as exc:
            extraccion = DocumentExtraction(
                estado="error",
                extractor="error_lectura",
                error=f"No pude releer el archivo: {exc}",
                metadata={
                    "tipo_documento": documento.get("tipo_documento", "documento"),
                    "numero_documento": documento.get("numero_documento"),
                },
            )

        with conn.transaction():
            existentes = repository.list_items(conn, documento["id_recepcion"])
            items = []
            if reemplazar_lineas and existentes:
                if not extraccion.filas or extraccion.metadata.get("tipo_documento") == "nota_credito":
                    raise HTTPException(
                        status_code=422,
                        detail="La nueva lectura no encontró productos; se conservaron las líneas actuales.",
                    )
                repository.invalidar_costos(conn, documento["id_recepcion"])
                repository.eliminar_items_recepcion(conn, documento["id_recepcion"])
                existentes = []
            if not existentes and extraccion.filas and extraccion.metadata.get("tipo_documento") != "nota_credito":
                items = _resolver_items(
                    conn,
                    _items_desde_filas_extraidas(
                        extraccion.filas,
                        origen_extraccion="ocr" if extraccion.extractor.startswith("rapidocr") else "estructurado",
                    ),
                    documento["id_proveedor"],
                )
                if extraccion.extractor.startswith("rapidocr"):
                    for item in items:
                        if item["estado_resolucion"] == "exacta":
                            item["estado_resolucion"] = "sugerida"
                            item["mensaje_revision"] = "Confirmá la lectura OCR antes de ingresar stock."
                for item in items:
                    repository.insert_item(conn, documento["id_recepcion"], item)
                repository.recalcular_cabecera(conn, documento["id_recepcion"])

            repository.actualizar_documento_extraido(
                conn,
                documento_id,
                {
                    "estado": extraccion.estado,
                    "extractor": extraccion.extractor,
                    "texto_extraido": extraccion.texto or None,
                    "metadata_extraida": extraccion.metadata,
                    "error_extraccion": extraccion.error,
                    "tipo_documento": extraccion.metadata.get("tipo_documento", "documento"),
                    "numero_documento": extraccion.metadata.get("numero_documento"),
                },
            )
            repository.registrar_formato_proveedor(
                conn,
                {
                    "id_proveedor": documento["id_proveedor"],
                    "tipo_documento": extraccion.metadata.get("tipo_documento", "documento"),
                    "extension": documento["extension"],
                    "extractor": extraccion.extractor,
                    "estado": extraccion.estado,
                    "confianza_promedio": _confianza_promedio(items),
                },
            )
            repository.marcar_requiere_revision(conn, documento["id_recepcion"])
            repository.recalcular_metricas_aprendizaje(conn, documento["id_recepcion"])
            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario or documento["id_usuario_creador"],
                id_sucursal=documento["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=documento["id_recepcion"],
                accion="recepcion_documento_reprocesado",
                detalle=f"Documento {documento['nombre_original']} reprocesado.",
                metadata={
                    "documento_id": documento_id,
                    "lineas_agregadas": len(items),
                    "lineas_reemplazadas": reemplazar_lineas,
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=documento["id_recepcion"],
            )
        return _detalle(conn, documento["id_recepcion"])
    finally:
        conn.close()


def _item_lectura_manual(payload: dict, numero_linea: int) -> dict:
    linea = "\t".join(
        (
            payload["codigo_proveedor"].strip(),
            payload["descripcion"].strip(),
            str(payload["cantidad"]),
            str(payload["costo_unitario"]),
        )
    )
    item = parsear_tabla(linea)[0]
    item.update(
        numero_linea=numero_linea,
        linea_original=linea,
        descuento_linea_pct=payload.get("descuento_linea_pct", Decimal("0")),
        origen_extraccion="manual",
        confianza_codigo=Decimal("1"),
        confianza_descripcion=Decimal("1"),
        confianza_cantidad=Decimal("1"),
        confianza_costo=Decimal("1"),
        lectura_confirmada=True,
    )
    return item


def guardar_lectura_item(recepcion_id: int, item_id: int | None, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            recepcion = repository.get_recepcion(conn, recepcion_id)
            if recepcion is None:
                raise HTTPException(status_code=404, detail="No existe la recepción")
            _validar_recepcion_editable(recepcion)

            if item_id is None:
                numero_linea = repository.siguiente_numero_linea(conn, recepcion_id)
            else:
                existente = repository.get_item(conn, recepcion_id, item_id)
                _validar_recepcion_editable(existente)
                numero_linea = existente["numero_linea"]

            item = _item_lectura_manual(payload, numero_linea)
            item = _resolver_items(conn, [item], recepcion["id_proveedor"])[0]
            if item_id is None:
                repository.insert_item(conn, recepcion_id, item)
                accion = "recepcion_linea_manual_agregada"
            else:
                repository.actualizar_lectura_item(conn, item_id, item)
                repository.incrementar_correcciones(conn, recepcion_id)
                repository.incrementar_correccion_formato(conn, recepcion["id_proveedor"])
                accion = "recepcion_lectura_corregida"

            repository.invalidar_costos(conn, recepcion_id)
            repository.recalcular_cabecera(conn, recepcion_id)
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            repository.recalcular_metricas_aprendizaje(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion=accion,
                detalle=f"Línea {numero_linea} revisada manualmente en recepción #{recepcion_id}.",
                metadata={
                    "item_id": item_id,
                    "codigo_proveedor": item["codigo_proveedor"],
                    "cantidad": str(item["cantidad"]),
                    "costo_unitario": str(item["costo_unitario"]),
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def listar_recepciones(*, estado: str | None, limit: int):
    if estado and estado not in ESTADOS_RECEPCION:
        raise HTTPException(status_code=400, detail="Estado de recepcion invalido")
    conn = get_connection()
    try:
        return repository.list_recepciones(conn, estado=estado, limit=limit)
    finally:
        conn.close()


def obtener_recepcion(recepcion_id: int):
    conn = get_connection()
    try:
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def anular_recepcion(recepcion_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            recepcion = repository.get_recepcion(conn, recepcion_id)
            if recepcion is None:
                raise HTTPException(status_code=404, detail="No existe la recepción")
            if recepcion["estado"] == "confirmada":
                raise HTTPException(
                    status_code=409,
                    detail="Una recepción confirmada no se anula desde el borrador porque ya afectó stock y costos.",
                )
            if recepcion["estado"] == "anulada":
                return _detalle(conn, recepcion_id)
            anulada = repository.anular_recepcion(
                conn,
                recepcion_id,
                motivo=payload["motivo"].strip(),
                usuario_id=payload.get("id_usuario"),
            )
            if anulada is None:
                raise HTTPException(status_code=409, detail="La recepción ya no se puede anular")
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_anulada",
                detalle=f"Recepción #{recepcion_id} anulada: {payload['motivo'].strip()}",
                metadata={"motivo": payload["motivo"].strip()},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def eliminar_linea(recepcion_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            item = repository.get_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(item)
            eliminada = repository.eliminar_item(conn, recepcion_id, item_id)
            if eliminada is None:
                raise HTTPException(status_code=404, detail="No existe la línea")
            repository.invalidar_costos(conn, recepcion_id)
            repository.recalcular_cabecera(conn, recepcion_id)
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            repository.incrementar_correcciones(conn, recepcion_id)
            repository.recalcular_metricas_aprendizaje(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario"),
                id_sucursal=item["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_linea_eliminada",
                detalle=f"Se quitó la línea #{item['numero_linea']} ({item.get('codigo_proveedor') or 'sin código'}).",
                metadata={"item_id": item_id, "codigo_proveedor": item.get("codigo_proveedor")},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def eliminar_documento(recepcion_id: int, documento_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    ruta = None
    try:
        with conn.transaction():
            recepcion = repository.get_recepcion(conn, recepcion_id)
            _validar_recepcion_editable(recepcion)
            documento = repository.get_documento(conn, documento_id)
            if documento is None or documento["id_recepcion"] != recepcion_id:
                raise HTTPException(status_code=404, detail="No existe el documento en esta recepción")
            eliminado = repository.eliminar_documento(conn, recepcion_id, documento_id)
            ruta = eliminado.get("ruta_relativa") if eliminado else None
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_documento_eliminado",
                detalle=f"Se desvinculó el documento {documento['nombre_original']}.",
                metadata={"documento_id": documento_id, "sha256": documento.get("sha256")},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        if ruta:
            uploads_root = UPLOADS_RECEPCIONES_DIR.parent.resolve()
            archivo = (uploads_root / ruta).resolve()
            if archivo.is_relative_to(uploads_root):
                try:
                    archivo.unlink(missing_ok=True)
                except OSError:
                    # La relación ya fue quitada; un archivo huérfano no debe romper la operación.
                    pass
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def clasificar_items_masivamente(recepcion_id: int, data):
    payload = data.model_dump()
    payload["ids_items"] = list(dict.fromkeys(payload["ids_items"]))
    conn = get_connection()
    try:
        with conn.transaction():
            recepcion = repository.get_recepcion(conn, recepcion_id)
            _validar_recepcion_editable(recepcion)
            rubro = repository.get_rubro_activo(conn, payload["rubro_propuesto"])
            categoria = repository.get_categoria_activa(conn, payload["id_categoria_propuesta"])
            if rubro is None or categoria is None:
                raise HTTPException(status_code=422, detail="El rubro o la categoría no están activos")
            if payload.get("id_marca_propuesta") and repository.get_marca_activa(
                conn, payload["id_marca_propuesta"]
            ) is None:
                raise HTTPException(status_code=422, detail="La marca elegida no está activa")
            payload.update(
                rubro_propuesto=rubro["nombre"],
                subtipo_propuesto=_normalizar_texto(payload["subtipo_propuesto"]),
            )
            actualizados = repository.clasificar_items_masivamente(conn, recepcion_id, payload)
            if len(actualizados) != len(payload["ids_items"]):
                raise HTTPException(
                    status_code=409,
                    detail="Alguna línea seleccionada ya está vinculada o no pertenece a esta recepción.",
                )
            repository.incrementar_correcciones(
                conn, recepcion_id, cantidad=len(actualizados)
            )
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            repository.recalcular_metricas_aprendizaje(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_clasificacion_masiva",
                detalle=f"Se clasificaron {len(actualizados)} líneas como {rubro['nombre']} / {categoria['nombre']}.",
                metadata={"items": actualizados, "subtipo": payload["subtipo_propuesto"]},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def resolver_sugerencia_regla(sugerencia_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            sugerencia = repository.get_sugerencia_regla(conn, sugerencia_id)
            if sugerencia is None:
                raise HTTPException(status_code=404, detail="No existe la sugerencia")
            if sugerencia["estado"] != "pendiente":
                raise HTTPException(status_code=409, detail="La sugerencia ya fue resuelta")
            resuelta = repository.resolver_sugerencia_regla(conn, sugerencia_id, payload)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario"),
                id_sucursal=None,
                entidad="recepcion_sugerencia_regla",
                entidad_id=sugerencia_id,
                accion=f"recepcion_regla_{payload['decision']}",
                detalle=f"Sugerencia de regla {payload['decision']}: {sugerencia['titulo']}.",
                metadata={"tipo": sugerencia["tipo"], "nota": payload.get("nota")},
                origen_tipo="recepcion_sugerencia_regla",
                origen_id=sugerencia_id,
            )
        return dict(resuelta)
    finally:
        conn.close()


def deshacer_coincidencia(recepcion_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            item = repository.get_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(item)
            if item["estado_resolucion"] != "exacta" or item.get("origen_resolucion") not in {
                "codigo_proveedor", "ean"
            }:
                raise HTTPException(
                    status_code=409,
                    detail="Solo se pueden deshacer coincidencias automáticas por código o EAN.",
                )

            propuesta = dict(item)
            _sugerir_alta(propuesta, repository.get_catalogo_referencia(conn))
            propuesta["mensaje_revision"] = (
                "Coincidencia automática descartada. Revisá la ficha antes de crear o vincular."
            )
            _aplicar_memoria_y_duplicados(
                propuesta,
                repository.list_memorias_clasificacion(conn),
                repository.list_catalogo_candidatos(conn),
            )
            repository.deshacer_coincidencia_item(conn, item_id, propuesta)
            repository.incrementar_correcciones(conn, recepcion_id, rechazo=True)
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            repository.recalcular_metricas_aprendizaje(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or item.get("id_usuario_creador"),
                id_sucursal=item["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_coincidencia_deshacida",
                detalle=f"Se descartó la coincidencia automática de la línea #{item['numero_linea']}.",
                metadata={
                    "item_id": item_id,
                    "origen_resolucion": item.get("origen_resolucion"),
                    "id_variante_descartada": item.get("id_variante"),
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def _validar_recepcion_editable(item):
    if item is None:
        raise HTTPException(status_code=404, detail="No existe la linea de recepcion")
    estado = item.get("recepcion_estado", item.get("estado"))
    if estado in {"confirmada", "anulada"}:
        raise HTTPException(status_code=409, detail="La recepcion ya no se puede editar")


def preparar_alta(recepcion_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            item = repository.get_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(item)
            rubro = repository.get_rubro_activo(conn, payload["rubro_propuesto"])
            if rubro is None:
                raise HTTPException(status_code=422, detail="El rubro elegido no existe o esta inactivo")
            categoria = repository.get_categoria_activa(conn, payload["id_categoria_propuesta"])
            if categoria is None:
                raise HTTPException(status_code=422, detail="La categoria elegida no existe o esta inactiva")
            if payload.get("id_marca_propuesta") and repository.get_marca_activa(
                conn, payload["id_marca_propuesta"]
            ) is None:
                raise HTTPException(status_code=422, detail="La marca elegida no existe o esta inactiva")

            payload.update(
                nombre_propuesto=_normalizar_texto(payload["nombre_propuesto"]),
                nombre_variante_propuesta=_normalizar_texto(payload["nombre_variante_propuesta"]),
                rubro_propuesto=rubro["nombre"],
                subtipo_propuesto=_normalizar_texto(payload["subtipo_propuesto"]),
            )
            repository.preparar_alta_item(conn, item_id, payload)
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario"),
                id_sucursal=item["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_alta_preparada",
                detalle=f"Linea #{item['numero_linea']} preparada como producto nuevo.",
                metadata={"item_id": item_id, "categoria": categoria["nombre"], "rubro": rubro["nombre"]},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def _eliminar_imagen_preparada(ruta_relativa: str | None):
    if not ruta_relativa:
        return
    uploads_root = (Path(__file__).resolve().parents[3] / "uploads").resolve()
    archivo = (uploads_root / ruta_relativa).resolve()
    if archivo.is_relative_to(uploads_root):
        try:
            archivo.unlink(missing_ok=True)
        except OSError:
            pass


def guardar_imagen_preparada_item(
    recepcion_id: int,
    item_id: int,
    *,
    nombre_archivo: str,
    mime_type: str | None,
    contenido: bytes,
    id_usuario: int | None,
):
    extension = Path(nombre_archivo or "").suffix.lower()
    if extension not in IMAGEN_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usá JPG, PNG o WEBP.")
    if not contenido:
        raise HTTPException(status_code=400, detail="La imagen está vacía.")
    if len(contenido) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 5MB.")

    UPLOADS_RECEPCIONES_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    nombre_guardado = f"{uuid4().hex}{extension}"
    destino = UPLOADS_RECEPCIONES_IMAGES_DIR / nombre_guardado
    ruta_relativa = f"catalogo/recepciones/{nombre_guardado}"
    destino.write_bytes(contenido)

    conn = get_connection()
    anterior = None
    guardada = False
    try:
        with conn.transaction():
            item = repository.get_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(item)
            if item["estado_resolucion"] not in {"nueva", "alta_preparada", "conflicto", "incompleta"}:
                raise HTTPException(status_code=409, detail="La imagen opcional sólo se prepara para productos nuevos.")
            anterior = item.get("imagen_ruta_relativa")
            repository.guardar_imagen_item(
                conn,
                item_id,
                {
                    "imagen_ruta_relativa": ruta_relativa,
                    "imagen_nombre_original": Path(nombre_archivo).name[:255],
                    "imagen_mime_type": (mime_type or "application/octet-stream")[:100],
                    "imagen_tamano_bytes": len(contenido),
                },
            )
            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario or item.get("id_usuario_creador"),
                id_sucursal=item["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_imagen_preparada",
                detalle=f"Imagen opcional preparada para la línea #{item['numero_linea']}.",
                metadata={"item_id": item_id, "nombre": Path(nombre_archivo).name},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        guardada = True
        _eliminar_imagen_preparada(anterior)
        return _detalle(conn, recepcion_id)
    except Exception:
        if not guardada:
            _eliminar_imagen_preparada(ruta_relativa)
        raise
    finally:
        conn.close()


def quitar_imagen_preparada_item(recepcion_id: int, item_id: int, *, id_usuario: int | None):
    conn = get_connection()
    ruta_relativa = None
    try:
        with conn.transaction():
            item = repository.get_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(item)
            ruta_relativa = item.get("imagen_ruta_relativa")
            repository.quitar_imagen_item(conn, item_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=id_usuario or item.get("id_usuario_creador"),
                id_sucursal=item["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_imagen_quitada",
                detalle=f"Imagen opcional quitada de la línea #{item['numero_linea']}.",
                metadata={"item_id": item_id},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        _eliminar_imagen_preparada(ruta_relativa)
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def aceptar_vinculo(recepcion_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            item = repository.get_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(item)
            variante = repository.get_variante_activa(conn, payload["id_variante"])
            if variante is None:
                raise HTTPException(status_code=422, detail="La variante elegida no existe o esta inactiva")
            repository.vincular_item(conn, item_id, variante["id"])
            repository.guardar_codigo_proveedor(
                conn,
                item["id_proveedor"],
                item["codigo_proveedor"],
                variante["id"],
            )
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario"),
                id_sucursal=item["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_vinculo_aceptado",
                detalle=f"Linea #{item['numero_linea']} vinculada a {variante['producto_nombre']}.",
                metadata={"item_id": item_id, "id_variante": variante["id"]},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


CENTAVOS = Decimal("0.01")


def _dinero(value: Decimal) -> Decimal:
    return Decimal(value or 0).quantize(CENTAVOS, rounding=ROUND_HALF_UP)


def _prorratear(total: Decimal, bases: list[Decimal]) -> list[Decimal]:
    total = _dinero(total)
    if not bases:
        return []
    if total == 0:
        return [Decimal("0.00") for _ in bases]
    base_total = sum(bases, Decimal("0.00"))
    if base_total <= 0:
        raise HTTPException(
            status_code=422,
            detail="No se pueden prorratear ajustes porque la base de los productos es cero.",
        )

    resultado = []
    acumulado = Decimal("0.00")
    for indice, base in enumerate(bases):
        if indice == len(bases) - 1:
            parte = total - acumulado
        else:
            parte = _dinero(total * base / base_total)
            acumulado += parte
        resultado.append(_dinero(parte))
    return resultado


def configurar_costos(recepcion_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            recepcion = repository.get_recepcion_editable(conn, recepcion_id)
            _validar_recepcion_editable(recepcion)
            items = [dict(item) for item in repository.list_items(conn, recepcion_id)]
            if not items:
                raise HTTPException(status_code=422, detail="La recepcion no tiene productos")

            descuentos_enviados = payload.get("descuentos_linea") or []
            ids_items = {item["id"] for item in items}
            ids_enviados = [ajuste["id_item"] for ajuste in descuentos_enviados]
            if len(ids_enviados) != len(set(ids_enviados)):
                raise HTTPException(status_code=422, detail="Hay descuentos de linea repetidos")
            if not set(ids_enviados).issubset(ids_items):
                raise HTTPException(status_code=422, detail="Hay descuentos para lineas que no pertenecen a la recepcion")
            descuentos = {
                ajuste["id_item"]: Decimal(ajuste["descuento_pct"])
                for ajuste in descuentos_enviados
            }
            notas_credito_linea = {
                ajuste["id_item"]: _dinero(ajuste.get("nota_credito_monto") or 0)
                for ajuste in descuentos_enviados
            }

            calculados = []
            for item in items:
                if item["cantidad"] is None or item["costo_unitario"] is None:
                    raise HTTPException(
                        status_code=422,
                        detail=f"La linea {item['numero_linea']} no tiene cantidad o costo valido.",
                    )
                porcentaje = descuentos.get(
                    item["id"], Decimal(item.get("descuento_linea_pct") or 0)
                )
                bruto = _dinero(
                    item.get("total_linea_documental")
                    if item.get("total_linea_documental") is not None
                    else Decimal(item["cantidad"]) * Decimal(item["costo_unitario"])
                )
                descuento_linea = _dinero(bruto * porcentaje / Decimal("100"))
                base = _dinero(bruto - descuento_linea)
                calculados.append(
                    {
                        "item": item,
                        "descuento_linea_pct": porcentaje,
                        "importe_bruto": bruto,
                        "descuento_linea_monto": descuento_linea,
                        "base_prorrateo": base,
                    }
                )

            subtotal_bruto = _dinero(sum((row["importe_bruto"] for row in calculados), Decimal("0")))
            descuento_lineas_total = _dinero(sum((row["descuento_linea_monto"] for row in calculados), Decimal("0")))
            base_total = _dinero(subtotal_bruto - descuento_lineas_total)
            descuento_global_pct = Decimal(payload["descuento_global_pct"])
            descuento_global_monto = _dinero(base_total * descuento_global_pct / Decimal("100"))
            bonificacion_factura = _dinero(payload["bonificacion_factura"])
            nota_credito = _dinero(payload["nota_credito"])
            if descuento_global_monto + bonificacion_factura + nota_credito > base_total:
                raise HTTPException(
                    status_code=422,
                    detail="Los descuentos, la bonificación y la nota de crédito superan el importe de los productos.",
                )

            flete = _dinero(payload["flete"])
            iva_factura = _dinero(payload["iva_factura"])
            otros_gastos = _dinero(payload["otros_gastos"])
            impuestos = _dinero(payload["impuestos_no_recuperables"])
            gastos_total = _dinero(flete + iva_factura + otros_gastos + impuestos)
            bases = [row["base_prorrateo"] for row in calculados]
            partes_descuento = _prorratear(descuento_global_monto, bases)
            partes_bonificacion = _prorratear(bonificacion_factura, bases)
            nota_credito_modo = payload.get("nota_credito_modo") or "global"
            if nota_credito_modo == "lineas":
                total_nota_asignada = _dinero(sum(notas_credito_linea.values(), Decimal("0")))
                if abs(total_nota_asignada - nota_credito) > CENTAVOS:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "La nota de crédito dirigida debe quedar asignada por completo. "
                            f"Asignado: ${total_nota_asignada}; nota: ${nota_credito}."
                        ),
                    )
                partes_nota = [notas_credito_linea.get(row["item"]["id"], Decimal("0.00")) for row in calculados]
            else:
                partes_nota = _prorratear(nota_credito, bases)
            partes_gastos = _prorratear(gastos_total, bases)

            for indice, row in enumerate(calculados):
                total_linea = _dinero(
                    row["base_prorrateo"]
                    - partes_descuento[indice]
                    - partes_bonificacion[indice]
                    - partes_nota[indice]
                    + partes_gastos[indice]
                )
                row.update(
                    prorrateo_descuento_global=partes_descuento[indice],
                    prorrateo_bonificacion_factura=partes_bonificacion[indice],
                    prorrateo_nota_credito=partes_nota[indice],
                    nota_credito_linea_monto=(
                        partes_nota[indice] if nota_credito_modo == "lineas" else Decimal("0.00")
                    ),
                    prorrateo_gastos=partes_gastos[indice],
                    costo_total_calculado=total_linea,
                    costo_unitario_calculado=_dinero(total_linea / Decimal(row["item"]["cantidad"])),
                )
                if row["costo_total_calculado"] < 0:
                    raise HTTPException(
                        status_code=422,
                        detail=f"La nota de crédito supera el costo de la línea {row['item']['numero_linea']}.",
                    )

            total_calculado = _dinero(
                sum((row["costo_total_calculado"] for row in calculados), Decimal("0"))
            )
            total_documental = payload.get("total_documental")
            total_documental = _dinero(total_documental) if total_documental is not None else None
            diferencia = (
                _dinero(total_documental - total_calculado)
                if total_documental is not None
                else None
            )
            conciliado = diferencia is not None and abs(diferencia) <= CENTAVOS

            costos = {
                "descuento_global_pct": descuento_global_pct,
                "bonificacion_factura": bonificacion_factura,
                "nota_credito": nota_credito,
                "nota_credito_modo": nota_credito_modo,
                "flete": flete,
                "iva_factura": iva_factura,
                "otros_gastos": otros_gastos,
                "impuestos_no_recuperables": impuestos,
                "total_documental": total_documental,
                "subtotal_bruto": subtotal_bruto,
                "descuento_lineas_total": descuento_lineas_total,
                "descuento_global_monto": descuento_global_monto,
                "total_calculado": total_calculado,
                "diferencia_conciliacion": diferencia,
                "conciliado": conciliado,
            }
            repository.guardar_costos(conn, recepcion_id, costos)
            for row in calculados:
                repository.guardar_costos_item(conn, row["item"]["id"], row)
                variante = (
                    repository.get_variante_activa(conn, row["item"]["id_variante"])
                    if row["item"].get("id_variante")
                    else None
                )
                alerta = {}
                _aplicar_alerta_costo(
                    alerta,
                    variante,
                    row["costo_unitario_calculado"],
                )
                repository.actualizar_alerta_costo_item(
                    conn,
                    row["item"]["id"],
                    alerta.get("variacion_costo_pct"),
                    alerta.get("alerta_costo"),
                )
            repository.actualizar_total_costo(conn, recepcion_id, total_calculado)
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            repository.recalcular_metricas_aprendizaje(conn, recepcion_id)

            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_costos_calculados",
                detalle=f"Costos calculados por ${total_calculado}; diferencia documental ${diferencia if diferencia is not None else 'sin total'}.",
                metadata={key: str(value) if value is not None else None for key, value in costos.items()},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def _margen_pct(costo: Decimal, precio: Decimal) -> Decimal | None:
    if costo <= 0:
        return None
    return _dinero((precio - costo) / costo * Decimal("100"))


def _variacion_pct(anterior: Decimal, nuevo: Decimal) -> Decimal | None:
    if anterior <= 0:
        return None
    return _dinero((nuevo - anterior) / anterior * Decimal("100"))


def _redondear_arriba(valor: Decimal, base: Decimal) -> Decimal:
    if valor <= 0:
        return Decimal("0.00")
    unidades = (valor / base).to_integral_value(rounding="ROUND_CEILING")
    return _dinero(unidades * base)


def _costo_proyectado(contexto: dict) -> Decimal:
    costo_ingreso = _dinero(contexto.get("costo_unitario_calculado") or 0)
    if contexto.get("id_variante") is None:
        return costo_ingreso
    stock = Decimal(contexto.get("stock_fisico_actual") or 0)
    cantidad = Decimal(contexto.get("cantidad") or 0)
    costo_anterior = Decimal(contexto.get("costo_anterior") or 0)
    if stock <= 0:
        return costo_ingreso
    return _dinero(((stock * costo_anterior) + (cantidad * costo_ingreso)) / (stock + cantidad))


def _regla_para_contexto(conn, contexto: dict, tipo_cliente: str):
    return precios_repository.buscar_regla_precio_aplicable(
        conn,
        {
            "id_categoria": contexto.get("id_categoria_precio"),
            "id_marca": contexto.get("id_marca_precio"),
            "id_familia_precio": contexto.get("id_familia_precio"),
            "id_proveedor": contexto.get("id_proveedor"),
            "rubro": contexto.get("rubro_precio"),
            "tipo_cliente": tipo_cliente,
        },
    )


def _precio_segun_estrategia(conn, contexto: dict, tipo: str, estrategia: str, costo_nuevo: Decimal, redondeo: Decimal):
    actual_key = f"precio_{tipo}_actual"
    propuesta_key = f"precio_{tipo}_propuesto"
    precio_actual = _dinero(contexto.get(actual_key) or contexto.get(propuesta_key) or 0)
    costo_anterior = _dinero(contexto.get("costo_anterior") or 0)

    if estrategia == "mantener_actuales":
        return precio_actual, None

    if estrategia == "mantener_margen" and costo_anterior > 0 and precio_actual > 0:
        margen = (precio_actual - costo_anterior) / costo_anterior
        return _redondear_arriba(costo_nuevo * (Decimal("1") + margen), redondeo), None

    regla = _regla_para_contexto(conn, contexto, tipo)
    if regla is not None:
        return _dinero(_calcular_precio_desde_regla(costo_nuevo, regla)["precio_lista"]), regla

    return precio_actual, None


def sugerir_precios_item(recepcion_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        recepcion = repository.get_recepcion_editable(conn, recepcion_id)
        _validar_recepcion_editable(recepcion)
        costos = repository.get_costos(conn, recepcion_id)
        if costos is None or not costos["conciliado"]:
            raise HTTPException(status_code=409, detail="Primero conciliá los costos de la recepción.")

        contexto = repository.get_contexto_precio_item(conn, recepcion_id, item_id)
        if contexto is None:
            raise HTTPException(status_code=404, detail="Línea de recepción inexistente.")
        if contexto.get("costo_unitario_calculado") is None:
            raise HTTPException(status_code=409, detail="La línea todavía no tiene un costo final conciliado.")

        contexto = dict(contexto)
        contexto["rubro_precio"] = payload.get("rubro") or contexto.get("rubro_precio")
        contexto["id_categoria_precio"] = payload.get("id_categoria") or contexto.get("id_categoria_precio")
        contexto["id_marca_precio"] = payload.get("id_marca")

        costo = _costo_proyectado(contexto)
        redondeo = payload["redondeo_base"]
        minorista, regla_minorista = _precio_segun_estrategia(
            conn, contexto, "minorista", "reglas", costo, redondeo
        )
        mayorista, regla_mayorista = _precio_segun_estrategia(
            conn, contexto, "mayorista", "reglas", costo, redondeo
        )
        nombre_regla_minorista = regla_minorista["nombre"] if regla_minorista else None
        nombre_regla_mayorista = regla_mayorista["nombre"] if regla_mayorista else None
        if minorista <= 0:
            minorista = _redondear_arriba(costo * Decimal("2.20"), redondeo)
            nombre_regla_minorista = "Criterio base de alta (120%)"
        if mayorista <= 0:
            mayorista = _redondear_arriba(costo * Decimal("1.55"), redondeo)
            nombre_regla_mayorista = "Criterio base de alta (55%)"
        return {
            "costo_unitario": costo,
            "precio_minorista_sugerido": minorista,
            "precio_mayorista_sugerido": mayorista,
            "margen_minorista_pct": _margen_pct(costo, minorista) if minorista > 0 else None,
            "margen_mayorista_pct": _margen_pct(costo, mayorista) if mayorista > 0 else None,
            "regla_minorista": nombre_regla_minorista,
            "regla_mayorista": nombre_regla_mayorista,
        }
    finally:
        conn.close()


def _construir_preview_item(conn, contexto: dict, *, estrategia: str, alerta_pct: Decimal, redondeo: Decimal, usuario_id: int | None):
    costo_anterior = _dinero(contexto.get("costo_anterior") or 0)
    costo_nuevo = _costo_proyectado(contexto)
    minorista_anterior = _dinero(contexto.get("precio_minorista_actual") or contexto.get("precio_minorista_propuesto") or 0)
    mayorista_anterior = _dinero(contexto.get("precio_mayorista_actual") or contexto.get("precio_mayorista_propuesto") or 0)
    minorista, regla_minorista = _precio_segun_estrategia(conn, contexto, "minorista", estrategia, costo_nuevo, redondeo)
    mayorista, regla_mayorista = _precio_segun_estrategia(conn, contexto, "mayorista", estrategia, costo_nuevo, redondeo)

    faltantes = []
    if minorista <= 0:
        faltantes.append("minorista")
    if mayorista <= 0:
        faltantes.append("mayorista")
    if faltantes:
        raise HTTPException(
            status_code=422,
            detail=f"La linea {contexto['numero_linea']} no tiene precio {' ni '.join(faltantes)} ni una regla aplicable.",
        )

    alertas = []
    var_costo = _variacion_pct(costo_anterior, costo_nuevo)
    var_minorista = _variacion_pct(minorista_anterior, minorista)
    var_mayorista = _variacion_pct(mayorista_anterior, mayorista)
    for etiqueta, valor in (("Costo", var_costo), ("Minorista", var_minorista), ("Mayorista", var_mayorista)):
        if valor is not None and abs(valor) >= alerta_pct:
            alertas.append(f"{etiqueta} {valor:+.2f}%")

    return {
        "estrategia_precio": estrategia,
        "costo_anterior_snapshot": costo_anterior,
        "precio_minorista_anterior_snapshot": minorista_anterior,
        "precio_mayorista_anterior_snapshot": mayorista_anterior,
        "precio_minorista_propuesto": minorista,
        "precio_mayorista_propuesto": mayorista,
        "margen_minorista_anterior_pct": _margen_pct(costo_anterior, minorista_anterior),
        "margen_mayorista_anterior_pct": _margen_pct(costo_anterior, mayorista_anterior),
        "margen_minorista_resultante_pct": _margen_pct(costo_nuevo, minorista),
        "margen_mayorista_resultante_pct": _margen_pct(costo_nuevo, mayorista),
        "id_regla_minorista": regla_minorista["id"] if regla_minorista else None,
        "id_regla_mayorista": regla_mayorista["id"] if regla_mayorista else None,
        "regla_minorista_snapshot": regla_minorista["nombre"] if regla_minorista else None,
        "regla_mayorista_snapshot": regla_mayorista["nombre"] if regla_mayorista else None,
        "alerta_precio": " · ".join(alertas) or None,
        "id_usuario_precio": usuario_id,
    }


def previsualizar_precios(recepcion_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            recepcion = repository.get_recepcion_editable(conn, recepcion_id)
            _validar_recepcion_editable(recepcion)
            costos = repository.get_costos(conn, recepcion_id)
            if costos is None or not costos["conciliado"]:
                raise HTTPException(status_code=409, detail="Primero conciliá los costos de la recepción.")
            items = repository.list_items(conn, recepcion_id)
            if not items:
                raise HTTPException(status_code=422, detail="La recepción no tiene productos.")

            alertas = 0
            for item in items:
                if item["estado_resolucion"] not in {"exacta", "alta_preparada"}:
                    raise HTTPException(status_code=409, detail="Resolvé todas las líneas antes de calcular precios.")
                contexto = repository.get_contexto_precio_item(conn, recepcion_id, item["id"])
                preview = _construir_preview_item(
                    conn,
                    contexto,
                    estrategia=payload["estrategia"],
                    alerta_pct=Decimal(payload["variacion_alerta_pct"]),
                    redondeo=Decimal(payload["redondeo_base"]),
                    usuario_id=payload.get("id_usuario"),
                )
                if preview["alerta_precio"]:
                    alertas += 1
                repository.guardar_preview_precio_item(conn, item["id"], preview)

            repository.actualizar_estado_recepcion(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario") or recepcion.get("id_usuario_creador"),
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_precios_previsualizados",
                detalle=f"Precios calculados con estrategia {payload['estrategia']}; {alertas} alerta(s).",
                metadata={
                    "estrategia": payload["estrategia"],
                    "variacion_alerta_pct": str(payload["variacion_alerta_pct"]),
                    "redondeo_base": str(payload["redondeo_base"]),
                    "alertas": alertas,
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def guardar_precio_item(recepcion_id: int, item_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            contexto = repository.get_contexto_precio_item(conn, recepcion_id, item_id)
            _validar_recepcion_editable(contexto)
            if contexto.get("costo_unitario_calculado") is None:
                raise HTTPException(status_code=409, detail="Primero conciliá los costos de la recepción.")
            costo_nuevo = _costo_proyectado(contexto)
            preview = {
                "estrategia_precio": "manual",
                "costo_anterior_snapshot": _dinero(contexto.get("costo_anterior") or 0),
                "precio_minorista_anterior_snapshot": _dinero(contexto.get("precio_minorista_actual") or contexto.get("precio_minorista_propuesto") or 0),
                "precio_mayorista_anterior_snapshot": _dinero(contexto.get("precio_mayorista_actual") or contexto.get("precio_mayorista_propuesto") or 0),
                "precio_minorista_propuesto": _dinero(payload["precio_minorista"]),
                "precio_mayorista_propuesto": _dinero(payload["precio_mayorista"]),
                "margen_minorista_anterior_pct": _margen_pct(_dinero(contexto.get("costo_anterior") or 0), _dinero(contexto.get("precio_minorista_actual") or 0)),
                "margen_mayorista_anterior_pct": _margen_pct(_dinero(contexto.get("costo_anterior") or 0), _dinero(contexto.get("precio_mayorista_actual") or 0)),
                "margen_minorista_resultante_pct": _margen_pct(costo_nuevo, _dinero(payload["precio_minorista"])),
                "margen_mayorista_resultante_pct": _margen_pct(costo_nuevo, _dinero(payload["precio_mayorista"])),
                "id_regla_minorista": None,
                "id_regla_mayorista": None,
                "regla_minorista_snapshot": None,
                "regla_mayorista_snapshot": None,
                "alerta_precio": None,
                "id_usuario_precio": payload.get("id_usuario"),
            }
            repository.guardar_preview_precio_item(conn, item_id, preview)
            repository.actualizar_estado_recepcion(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=payload.get("id_usuario"),
                id_sucursal=contexto["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_precio_manual",
                detalle=f"Precios de la línea #{contexto['numero_linea']} revisados manualmente.",
                metadata={"item_id": item_id, "minorista": str(payload["precio_minorista"]), "mayorista": str(payload["precio_mayorista"])},
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    finally:
        conn.close()


def _generar_sku(variante_id: int) -> str:
    return f"VAR-{variante_id:08d}"


def _generar_codigo_barras(variante_id: int) -> str:
    base = f"29{variante_id:010d}"
    suma = sum(int(char) if indice % 2 == 0 else int(char) * 3 for indice, char in enumerate(base))
    resto = suma % 10
    return base + str(0 if resto == 0 else 10 - resto)


def confirmar_recepcion(recepcion_id: int, data):
    payload = data.model_dump()
    conn = get_connection()
    try:
        with conn.transaction():
            recepcion = repository.bloquear_recepcion(conn, recepcion_id)
            if recepcion is None:
                raise HTTPException(status_code=404, detail="No existe la recepcion")
            if recepcion["estado"] == "confirmada":
                return _detalle(conn, recepcion_id)
            if recepcion["estado"] == "anulada":
                raise HTTPException(status_code=409, detail="La recepcion esta anulada")

            usuario_id = payload.get("id_usuario") or recepcion.get("id_usuario_creador")
            if not usuario_id:
                raise HTTPException(status_code=422, detail="No se pudo identificar al usuario confirmador")

            costos = repository.get_costos(conn, recepcion_id)
            if costos is None or not costos["conciliado"] or costos["total_documental"] is None:
                raise HTTPException(
                    status_code=409,
                    detail="Los costos deben estar calculados y conciliados antes de confirmar.",
                )

            items = [dict(item) for item in repository.list_items(conn, recepcion_id)]
            if not items:
                raise HTTPException(status_code=422, detail="La recepcion no tiene productos")
            pendientes = [
                item for item in items
                if item["estado_resolucion"] not in {"exacta", "alta_preparada"}
            ]
            if pendientes:
                raise HTTPException(
                    status_code=409,
                    detail=f"Quedan {len(pendientes)} linea(s) sin resolver.",
                )

            for item in items:
                if item["cantidad"] is None or item["costo_total_calculado"] is None:
                    raise HTTPException(
                        status_code=409,
                        detail=f"La linea {item['numero_linea']} no tiene costo final calculado.",
                    )

                if item["estado_resolucion"] == "alta_preparada":
                    precio_minorista = item.get("precio_minorista_propuesto")
                    precio_mayorista = item.get("precio_mayorista_propuesto")
                    if precio_minorista is None or Decimal(precio_minorista) <= 0:
                        raise HTTPException(
                            status_code=409,
                            detail=f"La linea {item['numero_linea']} necesita precio minorista.",
                        )
                    if precio_mayorista is None or Decimal(precio_mayorista) <= 0:
                        raise HTTPException(
                            status_code=409,
                            detail=f"La linea {item['numero_linea']} necesita precio mayorista.",
                        )

                    producto = catalogo_repository.crear_producto_catalogo(
                        conn,
                        {
                            "id_categoria": item["id_categoria_propuesta"],
                            "id_marca": item.get("id_marca_propuesta"),
                            "nombre": item["nombre_propuesto"],
                            "rubro": item["rubro_propuesto"],
                            "subtipo_catalogo": item["subtipo_propuesto"],
                            "tipo_item": "producto",
                            "stockeable": True,
                            "serializable": bool(item.get("serializable_propuesto")),
                            "rodado": None,
                            "tipo_bicicleta": None,
                            "material_cuadro": None,
                        },
                    )
                    variante = catalogo_repository.crear_variante_catalogo(
                        conn,
                        {
                            "id_producto": producto["id"],
                            "nombre_variante": item["nombre_variante_propuesta"],
                            "talle": None,
                            "color": None,
                            "sku": None,
                            "codigo_barras": None,
                            "codigo_proveedor": item["codigo_proveedor"],
                            "proveedor_preferido_id": recepcion["id_proveedor"],
                            "alicuota_iva": Decimal("21.00"),
                            "gravado": True,
                            "precio_minorista": Decimal(precio_minorista),
                            "precio_mayorista": Decimal(precio_mayorista),
                            "permite_precio_libre": False,
                        },
                    )
                    variante = catalogo_repository.asignar_identidad_variante(
                        conn,
                        variante["id"],
                        _generar_sku(variante["id"]),
                        _generar_codigo_barras(variante["id"]),
                    )
                    producto_id = producto["id"]
                    variante_id = variante["id"]
                    repository.guardar_codigo_proveedor(
                        conn,
                        recepcion["id_proveedor"],
                        item["codigo_proveedor"],
                        variante_id,
                    )
                    if item.get("imagen_ruta_relativa"):
                        catalogo_repository.crear_imagen_catalogo(
                            conn,
                            {
                                "id_producto": producto_id,
                                "id_variante": None,
                                "url": f"/uploads/{item['imagen_ruta_relativa']}",
                                "es_principal": True,
                                "orden": 0,
                            },
                        )
                else:
                    variante = repository.get_variante_activa(conn, item["id_variante"])
                    if variante is None:
                        raise HTTPException(
                            status_code=409,
                            detail=f"La variante de la linea {item['numero_linea']} ya no esta activa.",
                        )
                    producto_id = variante["id_producto"]
                    variante_id = variante["id"]

                ingreso = registrar_ingreso_stock(
                    conn,
                    {
                        "id_sucursal": recepcion["id_sucursal"],
                        "id_variante": variante_id,
                        "id_proveedor": recepcion["id_proveedor"],
                        "cantidad_ingresada": item["cantidad"],
                        "costo_productos": item["costo_total_calculado"],
                        "gastos_adicionales": Decimal("0"),
                        "origen_ingreso": "recepcion_mercaderia",
                        "observacion": f"Recepcion de mercaderia #{recepcion_id}, linea {item['numero_linea']}",
                        "id_usuario": usuario_id,
                    },
                )
                if item["estado_resolucion"] == "exacta" and item.get("precio_revisado"):
                    precio_minorista_nuevo = _dinero(item.get("precio_minorista_propuesto") or 0)
                    precio_mayorista_nuevo = _dinero(item.get("precio_mayorista_propuesto") or 0)
                    precio_minorista_anterior = _dinero(variante.get("precio_minorista") or 0)
                    precio_mayorista_anterior = _dinero(variante.get("precio_mayorista") or 0)
                    if precio_minorista_nuevo <= 0 or precio_mayorista_nuevo <= 0:
                        raise HTTPException(
                            status_code=409,
                            detail=f"La linea {item['numero_linea']} tiene una propuesta de precio incompleta.",
                        )
                    if (
                        precio_minorista_nuevo != precio_minorista_anterior
                        or precio_mayorista_nuevo != precio_mayorista_anterior
                    ):
                        precios_repository.insert_precio_movimiento(
                            conn,
                            {
                                "id_variante": variante_id,
                                "precio_minorista_anterior": precio_minorista_anterior,
                                "precio_minorista_nuevo": precio_minorista_nuevo,
                                "precio_mayorista_anterior": precio_mayorista_anterior,
                                "precio_mayorista_nuevo": precio_mayorista_nuevo,
                                "costo_anterior": ingreso["costo_promedio_anterior"],
                                "costo_nuevo": ingreso["costo_promedio_nuevo"],
                                "tipo_movimiento": "actualizacion_por_ingreso_stock",
                                "motivo": f"Precios autorizados en recepción de mercadería #{recepcion_id}",
                                "origen_tipo": "recepcion_mercaderia",
                                "origen_id": recepcion_id,
                                "id_usuario": usuario_id,
                            },
                        )
                        precios_repository.update_variante_precios(
                            conn,
                            variante_id,
                            {
                                "precio_minorista": precio_minorista_nuevo,
                                "precio_mayorista": precio_mayorista_nuevo,
                            },
                        )
                repository.guardar_resultado_confirmacion_item(
                    conn,
                    item["id"],
                    producto_id=producto_id,
                    variante_id=variante_id,
                    ingreso_id=ingreso["ingreso_id"],
                )

                clasificacion = repository.get_variante_activa(conn, variante_id)
                memoria = repository.guardar_memoria_clasificacion(
                    conn,
                    {
                        "id_proveedor": recepcion["id_proveedor"],
                        "descripcion_normalizada": item["descripcion_normalizada"],
                        "id_variante": variante_id,
                        "rubro": clasificacion.get("rubro") if clasificacion else item.get("rubro_propuesto"),
                        "id_categoria": clasificacion.get("id_categoria") if clasificacion else item.get("id_categoria_propuesta"),
                        "id_marca": clasificacion.get("id_marca") if clasificacion else item.get("id_marca_propuesta"),
                        "subtipo": clasificacion.get("subtipo_catalogo") if clasificacion else item.get("subtipo_propuesto"),
                        "ultima_recepcion_id": recepcion_id,
                    },
                )
                if memoria["confirmaciones"] >= 3:
                    repository.guardar_sugerencia_regla(
                        conn,
                        {
                            "id_proveedor": recepcion["id_proveedor"],
                            "tipo": "clasificacion",
                            "titulo": f"Clasificar como {memoria.get('subtipo') or memoria.get('rubro') or 'producto'}",
                            "motivo": (
                                f"La misma descripción fue confirmada {memoria['confirmaciones']} veces. "
                                "La regla queda pendiente de aprobación."
                            ),
                            "payload": {
                                "descripcion_normalizada": memoria["descripcion_normalizada"],
                                "rubro": memoria.get("rubro"),
                                "id_categoria": memoria.get("id_categoria"),
                                "id_marca": memoria.get("id_marca"),
                                "subtipo": memoria.get("subtipo"),
                            },
                            "ocurrencias": memoria["confirmaciones"],
                        },
                    )

            repository.marcar_confirmada(conn, recepcion_id, usuario_id)
            repository.recalcular_metricas_aprendizaje(conn, recepcion_id)
            auditoria_service.registrar_evento(
                conn,
                id_usuario=usuario_id,
                id_sucursal=recepcion["id_sucursal"],
                entidad="recepcion_mercaderia",
                entidad_id=recepcion_id,
                accion="recepcion_confirmada",
                detalle=f"Recepcion #{recepcion_id} confirmada con {len(items)} linea(s).",
                metadata={
                    "total_lineas": len(items),
                    "total_unidades": str(recepcion["total_unidades"]),
                    "total_costo": str(costos["total_calculado"]),
                },
                origen_tipo="recepcion_mercaderia",
                origen_id=recepcion_id,
            )
        return _detalle(conn, recepcion_id)
    except HTTPException:
        raise
    except (UniqueViolation, CheckViolation, ForeignKeyViolation) as exc:
        raise HTTPException(
            status_code=409,
            detail=f"No se pudo confirmar porque un dato de catalogo entra en conflicto: {exc.diag.message_primary}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        conn.close()
