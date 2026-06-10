import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listarUsuarios } from "../services/usuariosService";

const SESSION_STORAGE_KEY = "erp_session_usuario";
const SUCURSAL_DEFAULT = {
  id: 1,
  nombre: "Sucursal principal",
};

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [errorSesion, setErrorSesion] = useState("");

  useEffect(() => {
    inicializarSesion();
  }, []);

  async function inicializarSesion() {
    try {
      setCargandoSesion(true);
      setErrorSesion("");

      const data = await listarUsuarios({ solo_activos: true });
      const usuariosActivos = Array.isArray(data) ? data : [];

      setUsuarios(usuariosActivos);

      const guardado = localStorage.getItem(SESSION_STORAGE_KEY);
      const usuarioGuardado = guardado ? JSON.parse(guardado) : null;

      const usuarioValido = usuariosActivos.find(
        (usuario) => usuario.id === usuarioGuardado?.id,
      );

      if (usuarioValido) {
        setUsuarioActual(normalizarUsuarioSesion(usuarioValido));
      }
    } catch (err) {
      setErrorSesion(err.message || "No se pudo inicializar la sesión operativa");
    } finally {
      setCargandoSesion(false);
    }
  }

  function seleccionarUsuario(usuario) {
    const normalizado = normalizarUsuarioSesion(usuario);

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizado));
    setUsuarioActual(normalizado);
  }

  function cerrarSesionOperativa() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUsuarioActual(null);
  }

  const value = useMemo(
    () => ({
      usuarios,
      usuarioActual,
      sucursalActual: SUCURSAL_DEFAULT,
      cargandoSesion,
      errorSesion,
      seleccionarUsuario,
      cerrarSesionOperativa,
      recargarUsuariosSesion: inicializarSesion,
      usuarioId: usuarioActual?.id ?? null,
      sucursalId: SUCURSAL_DEFAULT.id,
      rolActual: usuarioActual?.rol ?? null,
      esAdministrador: usuarioActual?.rol === "administrador",
      esEncargado: usuarioActual?.rol === "encargado",
      esOperador: usuarioActual?.rol === "operador",
      esMecanico: usuarioActual?.rol === "mecanico",
    }),
    [usuarios, usuarioActual, cargandoSesion, errorSesion],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession debe usarse dentro de SessionProvider");
  }

  return context;
}

function normalizarUsuarioSesion(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    username: usuario.username,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
    id_sucursal: SUCURSAL_DEFAULT.id,
  };
}