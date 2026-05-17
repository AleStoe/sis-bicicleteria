import ReglasComercialesPanel from "../components/configuracion-comercial/ReglasComercialesPanel";
import PlanesTarjetaPanel from "../components/configuracion-comercial/PlanesTarjetaPanel";
import { styles } from "../components/configuracion-comercial/configuracionComercialStyles";

export default function ConfiguracionComercialPage() {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Configuración Comercial</h1>

        <p style={styles.subtitle}>
          Reglas de descuentos, recargos y planes de financiación.
        </p>
      </div>

      <ReglasComercialesPanel />

      <PlanesTarjetaPanel />
    </div>
  );
}