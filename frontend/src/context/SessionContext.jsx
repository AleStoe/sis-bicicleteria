import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginAuth } from "../services/authService";

const SESSION_STORAGE_KEY = "erp_session_usuario";
const SUCURSAL_DEFAULT = {
  id: 1,
  nombre: "Sucursal principal",
};

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [errorSesion, setErrorSesion] = useState("");

  useEffect(() => {
    inicializarSesion();
  }, []);

  function inicializarSesion() {
    try {
      setCargandoSesion(true);
      setErrorSesion("");

      const guardado = localStorage.getItem(SESSION_STORAGE_KEY);
      const usuarioGuardado = guardado ? JSON.parse(guardado) : null;

      if (usuarioGuardado?.id) {
        setUsuarioActual(normalizarUsuarioSesion(usuarioGuardado));
      }
    } catch (err) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setUsuarioActual(null);
      setErrorSesion(err.message || "No se pudo inicializar la sesión");
    } finally {
      setCargandoSesion(false);
    }
  }

  async function iniciarSesion({ username, password }) {
    setErrorSesion("");

    const usuario = await loginAuth({ username, password });
    const normalizado = normalizarUsuarioSesion(usuario);

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizado));
    setUsuarioActual(normalizado);

    return normalizado;
  }

  function cerrarSesionOperativa() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUsuarioActual(null);
  }

  // Compatibilidad temporal: algunos componentes viejos podrían seguir importando esto.
  function seleccionarUsuario(usuario) {
    const normalizado = normalizarUsuarioSesion(usuario);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalizado));
    setUsuarioActual(normalizado);
  }

  const value = useMemo(
    () => ({
      usuarios: usuarioActual ? [usuarioActual] : [],
      usuarioActual,
      sucursalActual: SUCURSAL_DEFAULT,
      cargandoSesion,
      errorSesion,
      iniciarSesion,
      seleccionarUsuario,
      cerrarSesionOperativa,
      recargarUsuariosSesion: inicializarSesion,
      usuarioId: usuarioActual?.id ?? null,
      sucursalId: usuarioActual?.id_sucursal ?? SUCURSAL_DEFAULT.id,
      rolActual: usuarioActual?.rol ?? null,
      esAdministrador: usuarioActual?.rol === "administrador",
      esEncargado: usuarioActual?.rol === "encargado",
      esOperador: usuarioActual?.rol === "operador",
      esMecanico: usuarioActual?.rol === "mecanico",
    }),
    [usuarioActual, cargandoSesion, errorSesion],
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
    email: usuario.email ?? null,
    rol: usuario.rol,
    activo: usuario.activo ?? true,
    id_sucursal: usuario.id_sucursal ?? SUCURSAL_DEFAULT.id,
  };
}
