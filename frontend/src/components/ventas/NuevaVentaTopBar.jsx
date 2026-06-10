import { Link } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import {
  topBarStyle,
  brandStyle,
  bikeStyle,
  topSubtleStyle,
  topSearchWrapStyle,
  topSearchStyle,
  searchIconStyle,
  topRightStyle,
  topLinkStyle,
} from "../../styles/pages/nuevaVentaPageStyles";


export default function NuevaVentaTopBar({ searchRef, query, onQueryChange, onBuscarEnter }) {
  const { usuarioNombre } = useSession();
  return (
    <header style={topBarStyle}>
      <div style={brandStyle}>
        <span style={bikeStyle}>🚲</span>
        <div>
          <strong>Sistema de Ventas - Bicicletería</strong>
          <div style={topSubtleStyle}>POS real: crear, cobrar y entregar desde checkout</div>
        </div>
      </div>

      <div style={topSearchWrapStyle}>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onBuscarEnter}
          placeholder="ESCANEAR PRODUCTO O CÓDIGO DE BARRAS · F2"
          style={topSearchStyle}
        />
        <span style={searchIconStyle}>⌕</span>
      </div>

      <div style={topRightStyle}>
        <span>Caja: CAJA 1</span>
        <span>Usuario: {usuarioNombre}</span>
        <Link to="/ventas" style={topLinkStyle}>Historial</Link>
      </div>
    </header>
  );
}
