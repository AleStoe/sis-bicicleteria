import { API_BASE_URL } from "../../config/appConfig";

export default function CatalogoDetalleModal({ item, onClose, onEdit }) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>{item.producto_nombre}</h2>
            <div style={mutedSmallStyle}>{item.nombre_variante}</div>
          </div>

          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={modalContentStyle}>
          <div>
            {item.imagen_principal ? (
              <img
                src={getImageUrl(item.imagen_principal)}
                alt={item.producto_nombre}
                style={modalImageStyle}
              />
            ) : (
              <div style={bigPlaceholderStyle}>Sin imagen</div>
            )}
          </div>

          <div style={modalInfoStyle}>
            <InfoRow label="SKU" value={item.sku} />
            <InfoRow label="EAN" value={item.codigo_barras} />
            <InfoRow label="Código proveedor" value={item.codigo_proveedor} />
            <InfoRow label="Marca" value={item.marca_nombre} />
            <InfoRow label="Categoría" value={item.categoria_nombre} />
            <InfoRow label="Proveedor" value={item.proveedor_preferido_nombre} />
            <InfoRow label="Stock físico" value={formatNumber(item.stock_fisico)} />
            <InfoRow label="Reservado" value={formatNumber(item.stock_reservado)} />
            <InfoRow
              label="Pendiente entrega"
              value={formatNumber(item.stock_vendido_pendiente_entrega)}
            />
            <InfoRow
              label="Stock disponible"
              value={formatNumber(item.stock_disponible)}
            />
            <InfoRow
              label="Precio minorista"
              value={formatMoney(item.precio_minorista)}
            />
            <InfoRow
              label="Precio mayorista"
              value={formatMoney(item.precio_mayorista)}
            />

            <div style={modalActionsStyle}>
              <button type="button" onClick={onEdit}>
                Editar
              </button>
              <button type="button" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: 3,
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
}

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: "20px",
};

const modalStyle = {
  width: "min(950px, 100%)",
  background: "white",
  borderRadius: "18px",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,.35)",
};

const modalHeaderStyle = {
  padding: "18px 22px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
};

const modalContentStyle = {
  display: "grid",
  gridTemplateColumns: "420px 1fr",
  gap: "20px",
  padding: "22px",
};

const modalImageStyle = {
  width: "100%",
  maxHeight: "420px",
  objectFit: "contain",
  borderRadius: "14px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const bigPlaceholderStyle = {
  height: "420px",
  borderRadius: "14px",
  border: "1px dashed #d0d5dd",
  display: "grid",
  placeItems: "center",
  background: "#f9fafb",
  color: "#667085",
};

const modalInfoStyle = {
  display: "grid",
  gap: "10px",
  alignContent: "start",
};

const infoRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  paddingBottom: "10px",
  borderBottom: "1px solid #f2f4f7",
};

const infoLabelStyle = {
  color: "#667085",
};

const mutedSmallStyle = {
  color: "#667085",
  fontSize: "13px",
  marginTop: "4px",
};

const modalActionsStyle = {
  marginTop: "16px",
  display: "flex",
  gap: "10px",
};