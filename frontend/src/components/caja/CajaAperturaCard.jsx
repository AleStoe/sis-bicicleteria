import { Card, Button, Input } from "../ui";

export default function CajaAperturaCard({
  montoApertura,
  setMontoApertura,
  onSubmit,
  puedeAbrirCaja,
  procesando,
}) {
  return (
    <Card title="Abrir caja" subtitle="No hay caja abierta para la sucursal actual.">
      <form onSubmit={onSubmit} style={styles.form}>
        <Input
          label="Monto de apertura"
          type="number"
          min="0"
          step="0.01"
          value={montoApertura}
          onChange={(e) => setMontoApertura(e.target.value)}
          required
        />

        <Button fullWidth disabled={!puedeAbrirCaja}>
          {procesando ? "Abriendo..." : "Abrir caja"}
        </Button>
      </form>
    </Card>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: "12px",
    maxWidth: "360px",
  },
};
