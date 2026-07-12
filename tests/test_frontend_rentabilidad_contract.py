from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


SENSITIVE_FRONTEND_FILES = [
    ROOT / "frontend" / "src" / "pages" / "DashboardPage.jsx",
    ROOT / "frontend" / "src" / "pages" / "RentabilidadPage.jsx",
    ROOT / "frontend" / "src" / "pages" / "RentabilidadDiariaPage.jsx",
    ROOT / "frontend" / "src" / "pages" / "CajaPage.jsx",
]


OLD_MAIN_KPI_LABELS = [
    "ganancia real",
    "margen real",
    "margen cobrado",
    "resultado del mes",
    "cubierto sin caja",
]


REQUIRED_CONCEPT_LABELS = [
    "Resultado distribuible",
    "Utilidad liberada",
    "Utilidad + financiero",
    "Capital recuperado",
    "Capital inmovilizado",
]


def test_frontend_no_reintroduce_old_profit_labels_in_sensitive_pages():
    combined = "\n".join(path.read_text(encoding="utf-8") for path in SENSITIVE_FRONTEND_FILES)
    lower = combined.lower()

    for label in OLD_MAIN_KPI_LABELS:
        assert label not in lower


def test_frontend_rentabilidad_uses_option_b_concept_labels():
    combined = "\n".join(path.read_text(encoding="utf-8") for path in SENSITIVE_FRONTEND_FILES)

    for label in REQUIRED_CONCEPT_LABELS:
        assert label in combined


def test_frontend_prorated_margin_stays_in_technical_audit_section():
    rentabilidad_page = (ROOT / "frontend" / "src" / "pages" / "RentabilidadPage.jsx").read_text(
        encoding="utf-8"
    )
    diaria_page = (ROOT / "frontend" / "src" / "pages" / "RentabilidadDiariaPage.jsx").read_text(
        encoding="utf-8"
    )

    assert "Auditoría técnica" in rentabilidad_page
    assert "Auditoría técnica" in diaria_page
    assert rentabilidad_page.index("Auditoría técnica") < rentabilidad_page.index("Margen prorrateado")
    assert 'AuditSection title="Auditoría técnica" rows={ajusteRows}' in diaria_page
    assert 'Metric title="Margen prorrateado"' not in diaria_page
