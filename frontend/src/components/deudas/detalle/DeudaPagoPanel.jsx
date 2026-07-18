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
  planesTarjeta = [],
}) {
  const deudaAbierta = deuda.estado === "abierta";
  const montoCliente = Number(pagoForm.monto_cliente || 0);
  const puedePrevisualizar = deudaAbierta && !guardando && !simulando && montoCliente > 0;
  const puedeRegistrar = deudaAbierta && !guardando && !simulando && previewPago;
  const labelMonto =
    pagoForm.medio_pago === "tarjeta" ? "Monto final en tarjeta" : "Cliente paga";

  return (
    <Card
      title="Registrar pago"
      subtitle="Cargá lo que paga el cliente. El sistema calcula cuánto cubre de la deuda."
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
            <Select
              label="Plan de tarjeta"
              value={`${pagoForm.cuotas || ""}__${pagoForm.entidad || ""}`}
              disabled={guardando || simulando || planesTarjeta.length === 0}
              onChange={(e) => {
                const plan = planesTarjeta.find(
                  (item) => `${item.cuotas}__${item.entidad || ""}` === e.target.value
                );

                if (!plan) return;

                setPagoForm((prev) => ({
                  ...prev,
                  cuotas: String(plan.cuotas),
                  entidad: plan.entidad || "",
                }));
              }}
            >
              {planesTarjeta.length === 0 ? (
                <option value="">Sin planes activos</option>
              ) : (
                planesTarjeta.map((plan) => (
                  <option key={plan.id} value={`${plan.cuotas}__${plan.entidad || ""}`}>
                    {formatPlanTarjeta(plan)}
                  </option>
                ))
              )}
            </Select>
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
            Al confirmar, se registra el cobro con el descuento o la financiacion que corresponda.
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
        <strong>Detalle del pago</strong>
        <span style={badgeStyle}>{preview.estado_estimado}</span>
      </div>

      <PreviewRow label="Saldo actual" value={formatMoney(preview.saldo_actual)} />
      <PreviewRow
        label="Cubre de la deuda"
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
          label="Financiacion incluida"
          value={`+ ${formatMoney(preview.recargo_aplicado)}`}
        />
      )}

      <PreviewRow
        label={preview.medio_pago === "tarjeta" ? "Total en tarjeta" : "Cliente paga"}
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
            ? ` · Financiacion ${preview.porcentaje_recargo_aplicado}%`
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

function formatPlanTarjeta(plan) {
  const partes = [];

  if (plan.nombre) partes.push(plan.nombre);
  if (plan.entidad) partes.push(plan.entidad);
  partes.push(`${plan.cuotas} cuota${Number(plan.cuotas) === 1 ? "" : "s"}`);

  const recargo = Number(plan.porcentaje_recargo_cliente || 0);
  if (Number.isFinite(recargo)) {
    partes.push(`${recargo.toFixed(2)}% al cliente`);
  }

  return partes.join(" · ");
}
