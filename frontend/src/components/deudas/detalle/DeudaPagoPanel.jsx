import { formatMoney } from "../../../utils/formatters";
import { Button, Card, Input, Select } from "../../ui";

const MEDIOS_PAGO = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "tarjeta",
];

export default function DeudaPagoPanel({
  deuda,
  pagoForm,
  setPagoForm,
  previewPago,
  previsualizarPago,
  completarSaldo,
  registrarPago,
  guardando,
  simulando,
}) {
  const deudaAbierta = deuda.estado === "abierta";
  const montoCliente = Number(pagoForm.monto_cliente || 0);
  const puedePrevisualizar = deudaAbierta && !guardando && !simulando && montoCliente > 0;
  const puedeRegistrar = deudaAbierta && !guardando && !simulando && previewPago;
  const labelMonto =
    pagoForm.medio_pago === "tarjeta" ? "Cliente paga / financia" : "Cliente paga";

  return (
    <Card
      title="Registrar pago"
      subtitle="Cargá lo que paga el cliente. El backend calcula la base que baja la deuda."
    >
      {!deudaAbierta ? (
        <div style={noteStyle}>
          La deuda no está abierta. No se pueden registrar pagos.
        </div>
      ) : (
        <form onSubmit={registrarPago} style={{ display: "grid", gap: "12px" }}>
          <Input
            label={labelMonto}
            type="number"
            min="0.01"
            step="0.01"
            value={pagoForm.monto_cliente}
            onChange={(e) =>
              setPagoForm((prev) => ({
                ...prev,
                monto_cliente: e.target.value,
              }))
            }
          />

          <Button
            type="button"
            variant="outline"
            disabled={guardando || simulando}
            onClick={completarSaldo}
          >
            Completar saldo
          </Button>

          <Select
            label="Medio de pago"
            value={pagoForm.medio_pago}
            onChange={(e) =>
              setPagoForm((prev) => ({
                ...prev,
                medio_pago: e.target.value,
              }))
            }
          >
            {MEDIOS_PAGO.map((medio) => (
              <option key={medio} value={medio}>
                {medio}
              </option>
            ))}
          </Select>

          {pagoForm.medio_pago === "tarjeta" && (
            <div style={tarjetaGridStyle}>
              <Input
                label="Cuotas"
                type="number"
                min="1"
                step="1"
                value={pagoForm.cuotas}
                onChange={(e) =>
                  setPagoForm((prev) => ({
                    ...prev,
                    cuotas: e.target.value,
                  }))
                }
              />

              <Input
                label="Entidad"
                value={pagoForm.entidad}
                onChange={(e) =>
                  setPagoForm((prev) => ({
                    ...prev,
                    entidad: e.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>
          )}

          <label style={textareaLabelStyle}>
            Nota
            <textarea
              value={pagoForm.nota}
              onChange={(e) =>
                setPagoForm((prev) => ({
                  ...prev,
                  nota: e.target.value,
                }))
              }
              rows={3}
              style={textareaStyle}
              placeholder="Opcional"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            fullWidth
            disabled={!puedePrevisualizar}
            onClick={previsualizarPago}
          >
            {simulando ? "Calculando..." : "Ver preview"}
          </Button>

          {previewPago && <PreviewPagoDeuda preview={previewPago} />}

          <Button type="submit" fullWidth disabled={!puedeRegistrar}>
            {guardando ? "Registrando..." : "Confirmar pago"}
          </Button>

          <div style={noteStyle}>
            La base cubierta, descuentos y recargos salen del backend. Al confirmar
            se registra la base calculada, no el flujo legacy.
          </div>
        </form>
      )}
    </Card>
  );
}

function PreviewPagoDeuda({ preview }) {
  const descuento = Number(preview.descuento_aplicado || 0);
  const recargo = Number(preview.recargo_aplicado || 0);

  return (
    <div style={previewStyle}>
      <div style={previewHeaderStyle}>
        <strong>Preview backend</strong>
        <span style={badgeStyle}>{preview.estado_estimado}</span>
      </div>

      <PreviewRow label="Saldo actual" value={formatMoney(preview.saldo_actual)} />
      <PreviewRow
        label="Base que baja deuda"
        value={formatMoney(preview.monto_base_aplicado)}
      />

      {descuento > 0 && (
        <PreviewRow
          label="Descuento aplicado"
          value={`- ${formatMoney(preview.descuento_aplicado)}`}
        />
      )}

      {recargo > 0 && (
        <PreviewRow
          label="Recargo aplicado"
          value={`+ ${formatMoney(preview.recargo_aplicado)}`}
        />
      )}

      <PreviewRow
        label={preview.medio_pago === "tarjeta" ? "Cliente financia" : "Cliente paga"}
        value={formatMoney(preview.monto_total_cobrado)}
        strong
      />

      <PreviewRow
        label="Saldo estimado"
        value={formatMoney(preview.saldo_restante_estimado)}
      />

      {preview.medio_pago === "tarjeta" && (
        <div style={tarjetaInfoStyle}>
          {preview.cuotas ? `${preview.cuotas} cuota(s)` : "Tarjeta"}
          {preview.porcentaje_recargo_aplicado
            ? ` · Recargo ${preview.porcentaje_recargo_aplicado}%`
            : ""}
        </div>
      )}
    </div>
  );
}

function PreviewRow({ label, value, strong = false }) {
  return (
    <div style={previewRowStyle}>
      <span>{label}</span>
      <strong style={strong ? totalStyle : undefined}>{value}</strong>
    </div>
  );
}

const noteStyle = {
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "12px",
  borderRadius: "8px",
  color: "#344054",
};

const textareaLabelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 600,
};

const textareaStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 12px",
  outline: "none",
  resize: "vertical",
  fontSize: 14,
};

const tarjetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "0.7fr 1.3fr",
  gap: 10,
};

const previewStyle = {
  border: "1px solid #d0d5dd",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 8,
  background: "#fcfcfd",
};

const previewHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  marginBottom: 4,
};

const previewRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  borderTop: "1px solid #eaecf0",
  paddingTop: 8,
  color: "#344054",
};

const totalStyle = {
  fontSize: 18,
  color: "#111827",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "4px 8px",
  background: "#ecfdf3",
  color: "#067647",
  fontSize: 12,
  fontWeight: 800,
};

const tarjetaInfoStyle = {
  marginTop: 4,
  color: "#667085",
  fontSize: 13,
};
