from pathlib import Path

from app.modules.configuracion_negocio.defaults import DEFAULT_CONFIGURACION_NEGOCIO
from app.modules.configuracion_negocio import repository as config_repository
from app.modules.configuracion_negocio.repository import upsert_configuracion_negocio


def _asegurar_tabla_configuracion(db_conn):
    for migration in [
        "database/migrations/20260618_01_create_configuracion_negocio.sql",
        "database/migrations/20260619_02_add_descuento_calculadora_precios_config.sql",
    ]:
        sql = Path(migration).read_text(encoding="utf-8")
        with db_conn.cursor() as cur:
            cur.execute(sql)
    db_conn.commit()


def test_actualizar_configuracion_negocio_guarda_texto(client, db_conn):
    _asegurar_tabla_configuracion(db_conn)

    payload = {
        **DEFAULT_CONFIGURACION_NEGOCIO,
        "whatsapp_cierre": "Gracias por confiar en nosotros. Probando texto editable.",
    }

    response = client.put("/configuracion-negocio", json=payload)

    assert response.status_code == 200, response.text
    assert response.json()["whatsapp_cierre"] == payload["whatsapp_cierre"]


def test_upsert_configuracion_negocio_ignora_columna_no_aplicada(monkeypatch, db_conn):
    _asegurar_tabla_configuracion(db_conn)

    payload = {
        **DEFAULT_CONFIGURACION_NEGOCIO,
        "whatsapp_cierre": "Texto guardado sin columna accesoria",
    }

    columnas_reales = config_repository.get_configuracion_negocio_columnas(db_conn)
    columnas_simuladas = {
        columna
        for columna in columnas_reales
        if columna != "porcentaje_descuento_contado_calculadora_precios"
    }

    monkeypatch.setattr(
        config_repository,
        "get_configuracion_negocio_columnas",
        lambda conn: columnas_simuladas,
    )

    row = upsert_configuracion_negocio(db_conn, payload)
    db_conn.commit()

    assert row["whatsapp_cierre"] == payload["whatsapp_cierre"]
