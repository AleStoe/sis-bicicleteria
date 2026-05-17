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
  registrarPago,
  guardando,
}) {
  const deudaAbierta = deuda.estado === "abierta";
  const puedeRegistrar =
    deudaAbierta && !guardando && Number(pagoForm.monto || 0) > 0;

  return (
    <Card
      title="Registrar pago"
      subtitle="Imputa un pago contra la deuda abierta"
    >
      {!deudaAbierta ? (
        <div style={noteStyle}>
          La deuda no está abierta. No se pueden registrar pagos.
        </div>
      ) : (
        <form onSubmit={registrarPago} style={{ display: "grid", gap: "12px" }}>
          <Input
            label="Monto"
            type="number"
            min="0.01"
            step="0.01"
            value={pagoForm.monto}
            onChange={(e) =>
              setPagoForm((prev) => ({
                ...prev,
                monto: e.target.value,
              }))
            }
          />

          <Button
            type="button"
            variant="outline"
            disabled={guardando}
            onClick={() =>
              setPagoForm((prev) => ({
                ...prev,
                monto: String(deuda.saldo_actual),
              }))
            }
          >
            Usar saldo total
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

          <Button type="submit" fullWidth disabled={!puedeRegistrar}>
            {guardando ? "Registrando..." : "Registrar pago"}
          </Button>

          <div style={noteStyle}>
            Si no hay caja abierta, el backend va a rechazar el pago.
          </div>
        </form>
      )}
    </Card>
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
