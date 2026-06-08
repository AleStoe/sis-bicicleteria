import { useBreakpoint } from "../../ui";

export default function VentaDocumentosPanel({ ventaId }) {
  const { isMobile } = useBreakpoint();
  const baseUrl = `http://127.0.0.1:8000/documentos/ventas/${ventaId}/comprobante-x`;

  function abrirComprobante() {
    window.open(baseUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section style={{ ...panelStyle, ...(isMobile ? panelMobileStyle : {}) }}>
      <div>
        <h3 style={titleStyle}>Documentos</h3>
        <p style={textStyle}>
          Comprobantes imprimibles asociados a esta venta.
        </p>
      </div>

      <div style={{ ...actionsStyle, ...(isMobile ? actionsMobileStyle : {}) }}>
        <button
          type="button"
          onClick={abrirComprobante}
          style={{ ...primaryButtonStyle, ...(isMobile ? primaryButtonMobileStyle : {}) }}
        >
          Ver Comprobante X
        </button>
      </div>
    </section>
  );
}

const panelStyle = {
  background: "#ffffff",
  borderRadius: "16px",
  padding: "18px",
  marginBottom: "18px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
};

const panelMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  padding: "14px",
  gap: "12px",
};

const titleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
  color: "#111827",
};

const textStyle = {
  margin: "4px 0 0",
  color: "#6b7280",
  fontSize: "14px",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const actionsMobileStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
};

const primaryButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "10px 14px",
  cursor: "pointer",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 700,
};

const primaryButtonMobileStyle = {
  width: "100%",
  minHeight: 44,
};
