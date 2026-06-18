import { Outlet, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import useMediaQuery from "../../hooks/useMediaQuery";
import { useSession } from "../../context/SessionContext";
import CambiarPasswordModal from "./CambiarPasswordModal";
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
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const userMenuRef = useRef(null);
  const contentRef = useRef(null);
  const { usuarioActual, cerrarSesionOperativa, rolLabel } = useSession();

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    contentRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobile && menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, menuOpen]);

  useEffect(() => {
    function cerrarSiClickAfuera(event) {
      if (!userMenuRef.current) return;

      if (!userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", cerrarSiClickAfuera);

    return () => {
      document.removeEventListener("mousedown", cerrarSiClickAfuera);
    };
  }, []);

  function abrirCambioPassword() {
    setUserMenuOpen(false);
    setPasswordModalOpen(true);
  }

  function cerrarSesion() {
    setUserMenuOpen(false);
    cerrarSesionOperativa();
  }

  return (
    <>
      <CambiarPasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />

      <div style={appShellStyle(isMobile)}>
        {!isMobile && <Sidebar />}

        {isMobile && menuOpen && (
          <div style={mobileOverlayStyle} onClick={() => setMenuOpen(false)}>
            <div
              style={mobileSidebarPanelStyle}
              onClick={(event) => event.stopPropagation()}
            >
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        <div style={mainContainerStyle}>
          <header style={topbarStyle(isMobile)}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minWidth: 0,
              }}
            >
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
                {!isMobile && (
                  <div style={subtleStyle}>Sistema de gestión integral</div>
                )}
              </div>
            </div>

            <div style={styles.userMenuWrapper} ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((current) => !current)}
                style={styles.userButton}
              >
                <div style={styles.userAvatar}>
                  {getInicialUsuario(usuarioActual)}
                </div>

                {!isMobile && (
                  <div style={styles.userButtonText}>
                    <strong style={styles.userName}>
                      {formatUsuarioSesion(usuarioActual)}
                    </strong>
                    <span style={styles.userRole}>{rolLabel || "Usuario"}</span>
                  </div>
                )}

                <ChevronDown size={17} />
              </button>

              {userMenuOpen && (
                <div style={styles.userDropdown}>
                  <div style={styles.dropdownHeader}>
                    <strong>{usuarioActual?.nombre || "Usuario"}</strong>
                    <span>{rolLabel || usuarioActual?.rol || "Usuario"}</span>
                  </div>

                  <button
                    type="button"
                    style={styles.dropdownItem}
                    disabled
                    title="Perfil básico informativo por ahora"
                  >
                    Mi perfil
                  </button>

                  <button
                    type="button"
                    onClick={abrirCambioPassword}
                    style={styles.dropdownItem}
                  >
                    Cambiar contraseña
                  </button>

                  <div style={styles.dropdownSeparator} />

                  <button
                    type="button"
                    onClick={cerrarSesion}
                    style={styles.dropdownDanger}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </header>

          <main ref={contentRef} style={contentStyle(isMobile)}>{children || <Outlet />}</main>
        </div>
      </div>
    </>
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

function getInicialUsuario(usuario) {
  const base = usuario?.nombre || usuario?.username || "U";
  return base.trim().charAt(0).toUpperCase();
}

const styles = {
  userMenuWrapper: {
    position: "relative",
    display: "flex",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  userButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    borderRadius: 14,
    padding: "6px 9px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
    maxWidth: 310,
  },
  userAvatar: {
    width: 31,
    height: 31,
    borderRadius: 11,
    background: "linear-gradient(135deg, #FF6A00, #ea5f00)",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    flexShrink: 0,
  },
  userButtonText: {
    display: "grid",
    gap: 1,
    textAlign: "left",
    minWidth: 0,
  },
  userName: {
    color: "#0f172a",
    fontSize: 13,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 210,
  },
  userRole: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  userDropdown: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 10px)",
    width: 240,
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
    padding: 8,
    zIndex: 100,
  },
  dropdownHeader: {
    display: "grid",
    gap: 3,
    padding: "10px 11px 12px",
    borderBottom: "1px solid #e2e8f0",
    marginBottom: 6,
    color: "#0f172a",
  },
  dropdownItem: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#0f172a",
    borderRadius: 11,
    padding: "10px 11px",
    textAlign: "left",
    fontWeight: 900,
    cursor: "pointer",
  },
  dropdownSeparator: {
    height: 1,
    background: "#e2e8f0",
    margin: "6px 4px",
  },
  dropdownDanger: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#b91c1c",
    borderRadius: 11,
    padding: "10px 11px",
    textAlign: "left",
    fontWeight: 1000,
    cursor: "pointer",
  },
};
