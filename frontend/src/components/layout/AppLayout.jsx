import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import useMediaQuery from "../../hooks/useMediaQuery";
import { useSession } from "../../context/SessionContext";
import {
  appShellStyle,
  mainContainerStyle,
  topbarStyle,
  contentStyle,
  logoStyle,
  subtleStyle,
  mobileMenuButtonStyle,
  mobileOverlayStyle,
  mobileSidebarPanelStyle,
} from "../../styles/layout/appLayoutStyles";

export default function AppLayout({ children }) {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const { usuarioActual, cerrarSesionOperativa } = useSession();

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    document.body.style.overflow = isMobile && menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, menuOpen]);

  return (
    <div style={appShellStyle(isMobile)}>
      {!isMobile && <Sidebar />}

      {isMobile && menuOpen && (
        <div style={mobileOverlayStyle} onClick={() => setMenuOpen(false)}>
          <div style={mobileSidebarPanelStyle} onClick={(event) => event.stopPropagation()}>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div style={mainContainerStyle}>
        <header style={topbarStyle(isMobile)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                style={mobileMenuButtonStyle}
                aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={logoStyle(isMobile)}>Emprendimiento Agus ERP</div>
              {!isMobile && <div style={subtleStyle}>Sistema de gestión integral</div>}
            </div>
          </div>

          <div style={styles.sessionBox}>
            {!isMobile && (
              <div style={styles.sessionText}>
                {formatUsuarioSesion(usuarioActual)}
              </div>
            )}

            <button
              type="button"
              onClick={cerrarSesionOperativa}
              style={styles.logoutButton}
            >
              Salir
            </button>
          </div>
        </header>

        <main style={contentStyle(isMobile)}>{children || <Outlet />}</main>
      </div>
    </div>
  );
}

function formatUsuarioSesion(usuario) {
  if (!usuario) return "-";

  if (usuario.nombre) {
    return usuario.username
      ? `${usuario.nombre} (@${usuario.username})`
      : usuario.nombre;
  }

  return usuario.id ? `Usuario #${usuario.id}` : "-";
}

const styles = {
  sessionBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    minWidth: 0,
  },
  sessionText: {
    color: "#64748b",
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 260,
  },
  logoutButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 12,
    padding: "9px 11px",
    fontWeight: 1000,
    cursor: "pointer",
  },
};
