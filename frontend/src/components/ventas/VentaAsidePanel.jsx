import CarritoVentaPanel from "./CarritoVentaPanel";
import ResumenVentaPanel from "./ResumenVentaPanel";
import CheckoutVentaPanel from "./CheckoutVentaPanel";
import {
  rightPanelStyle,
  saleTopStyle,
  clientLabelStyle,
  clientSelectStyle,
  fieldStyle,
  textareaStyle,
  checkStyle,
} from "../../styles/pages/nuevaVentaPageStyles";

export default function VentaAsidePanel({
  clientes,
  clienteId,
  tipoPrecio,
  onCambiarCliente,
  onTipoPrecioChange,
  items,
  total,
  serializadasPorVariante,
  cargandoSerializadas,
  onCargarSerializadas,
  onSeleccionarSerializada,
  onCambiarCantidad,
  onQuitarItem,
  onActualizarItem,
  observaciones,
  onObservacionesChange,
  usarCredito,
  onUsarCreditoChange,
  guardando,
  onVaciar,
  onFinalizar,
}) {
  return (
    <aside style={rightPanelStyle}>
      <div style={saleTopStyle}>
        <h2 style={{ margin: 0 }}>Venta</h2>

        <label style={clientLabelStyle}>
          Cliente
          <select value={clienteId} onChange={(e) => onCambiarCliente(e.target.value)} style={clientSelectStyle}>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre} #{cliente.id}
              </option>
            ))}
          </select>
        </label>

        <label style={clientLabelStyle}>
          Precio
          <select
            value={tipoPrecio}
            onChange={(e) => onTipoPrecioChange(e.target.value)}
            style={clientSelectStyle}
          >
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
          </select>
        </label>
      </div>

      <CarritoVentaPanel
        items={items}
        serializadasPorVariante={serializadasPorVariante}
        cargandoSerializadas={cargandoSerializadas}
        onCargarSerializadas={onCargarSerializadas}
        onSeleccionarSerializada={onSeleccionarSerializada}
        onCambiarCantidad={onCambiarCantidad}
        onQuitarItem={onQuitarItem}
        onActualizarItem={onActualizarItem}
      />

      <ResumenVentaPanel total={total} />

      <label style={fieldStyle}>
        <span>Observaciones</span>
        <textarea
          value={observaciones}
          onChange={(e) => onObservacionesChange(e.target.value)}
          placeholder="Opcional"
          style={textareaStyle}
        />
      </label>

      <label style={checkStyle}>
        <input
          type="checkbox"
          checked={usarCredito}
          onChange={(e) => onUsarCreditoChange(e.target.checked)}
        />
        Usar saldo a favor si existe
      </label>

      <CheckoutVentaPanel
        total={total}
        tipoPrecio={tipoPrecio}
        items={items}
        guardando={guardando}
        onVaciar={onVaciar}
        onFinalizar={onFinalizar}
      />
    </aside>
  );
}
