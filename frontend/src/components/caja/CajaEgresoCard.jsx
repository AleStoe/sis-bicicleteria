import { Card, Button, Input } from "../ui";

export default function CajaEgresoCard({
  egreso,
  setEgreso,
  onSubmit,
  puedeRegistrarEgreso,
  procesando,
}) {
  return (
    <Card title="Registrar egreso" subtitle="Registrar salida manual de efectivo">
      <form onSubmit={onSubmit} style={styles.form}>
        <Input
          label="Monto"
          type="number"
          min="0.01"
          step="0.01"
          value={egreso.monto}
          onChange={(e) =>
            setEgreso((prev) => ({ ...prev, monto: e.target.value }))
          }
          required
        />

        <Input
          label="Nota"
          type="text"
          value={egreso.nota}
          onChange={(e) =>
            setEgreso((prev) => ({ ...prev, nota: e.target.value }))
          }
          required
        />

        <Button fullWidth disabled={!puedeRegistrarEgreso}>
          {procesando ? "Guardando..." : "Registrar egreso"}
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
};
