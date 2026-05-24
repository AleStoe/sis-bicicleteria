import { Card, Button, Input } from "../ui";

export default function CajaCierreCard({
  montoReal,
  setMontoReal,
  efectivoTeorico,
  onSubmit,
  puedeCerrarCaja,
  procesando,
  formatCurrency,
}) {
  return (
    <Card title="Cerrar caja" subtitle="Registrar cierre y diferencia">
      <form onSubmit={onSubmit} style={styles.form}>
        <Input
          label="Dinero contado en efectivo"
          type="number"
          min="0"
          step="0.01"
          value={montoReal}
          onChange={(e) => setMontoReal(e.target.value)}
          required
        />

        <div style={styles.teorico}>
          Teórico efectivo: <strong>{formatCurrency(efectivoTeorico)}</strong>
        </div>

        <Button fullWidth variant="danger" disabled={!puedeCerrarCaja}>
          {procesando ? "Cerrando..." : "Cerrar caja"}
        </Button>
      </form>
    </Card>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: "12px",
  },
  teorico: {
    color: "#555",
  },
};
