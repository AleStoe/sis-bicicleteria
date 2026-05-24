import { Card, Button, Input, Select } from "../ui";

export default function CajaAjusteCard({
  ajuste,
  setAjuste,
  onSubmit,
  puedeRegistrarAjuste,
  procesando,
}) {
  return (
    <Card title="Ajuste de caja" subtitle="Correcciones manuales auditables">
      <form onSubmit={onSubmit} style={styles.form}>
        <Select
          label="Tipo de ajuste"
          value={ajuste.direccion}
          onChange={(e) =>
            setAjuste((prev) => ({
              ...prev,
              direccion: e.target.value,
            }))
          }
        >
          <option value="positivo">Ingreso (suma dinero)</option>
          <option value="negativo">Egreso (resta dinero)</option>
        </Select>

        <Input
          label="Monto"
          type="number"
          min="0.01"
          step="0.01"
          value={ajuste.monto}
          onChange={(e) =>
            setAjuste((prev) => ({ ...prev, monto: e.target.value }))
          }
          required
        />

        <Input
          label="Nota"
          type="text"
          value={ajuste.nota}
          onChange={(e) =>
            setAjuste((prev) => ({ ...prev, nota: e.target.value }))
          }
          required
        />

        <Button fullWidth disabled={!puedeRegistrarAjuste}>
          {procesando ? "Guardando..." : "Registrar ajuste"}
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
