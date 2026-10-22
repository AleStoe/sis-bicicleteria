from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_search_field_cierra_teclado_y_expone_accion_buscar():
    component = (
        ROOT / "frontend" / "src" / "components" / "ui" / "SearchField.jsx"
    ).read_text(encoding="utf-8")

    assert 'type="search"' in component
    assert 'inputMode="search"' in component
    assert 'enterKeyHint="search"' in component
    assert "input?.blur()" in component
    assert "<Search size={19}" in component
    assert 'position: "absolute"' in component
    assert 'paddingRight: 54' in component
    assert 'overflow: "hidden"' in component


def test_buscadores_operativos_reutilizan_el_control_movil():
    paths = [
        "pages/CatalogoPage.jsx",
        "pages/BicicletasSerializadasPage.jsx",
        "pages/CatalogoMaestroPage.jsx",
        "pages/ClientesListPage.jsx",
        "pages/EtiquetasPage.jsx",
        "pages/TallerListPage.jsx",
        "pages/TallerRendimientoPage.jsx",
        "pages/NuevaReservaPage.jsx",
        "components/ventas/catalogo/CatalogoPOSPanel.jsx",
        "components/ventas/item/VentaItemSerializadaPanel.jsx",
        "components/serializadas/AcondicionamientoModal.jsx",
    ]

    for relative_path in paths:
        source = (ROOT / "frontend" / "src" / relative_path).read_text(encoding="utf-8")
        assert "SearchField" in source, relative_path


def test_autofoco_de_lectores_se_conserva_solo_en_escritorio():
    for relative_path in (
        "pages/AltaMercaderiaPage.jsx",
        "pages/StockPage.jsx",
        "pages/PreciosPage.jsx",
    ):
        source = (ROOT / "frontend" / "src" / relative_path).read_text(encoding="utf-8")
        assert "if (!isMobile) setTimeout" in source, relative_path


def test_busqueda_de_componentes_muestra_nombres_y_codigos_sin_columna_angosta():
    component = (
        ROOT / "frontend" / "src" / "components" / "serializadas" / "AcondicionamientoModal.jsx"
    ).read_text(encoding="utf-8")

    assert 'gridColumn: "1 / -1"' in component
    assert "nombreComponente(item)" in component
    assert "codigosComponente(item)" in component
    assert "Componente seleccionado" in component
    assert "overflowX: \"hidden\"" in component


def test_seguimiento_de_pieza_retirada_explicita_que_debe_cargarse():
    component = (
        ROOT / "frontend" / "src" / "components" / "serializadas" / "AcondicionamientoModal.jsx"
    ).read_text(encoding="utf-8")

    assert "¿Qué pasó con la pieza retirada?" in component
    assert "¿Cómo compensó el proveedor?" in component
    assert "¿Por qué se descartó?" in component
    assert "guardada en depósito, estante B" in component
    assert "Resolución o referencia" not in component
