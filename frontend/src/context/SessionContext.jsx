import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginAuth } from "../services/authService";
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
} from "../services/sessionStore";

const LABELS_ROL = {
  administrador: "Administrador",
  encargado: "Encargado",
  operador: "Operador",
  mecanico: "Taller",
};

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

  useEffect(() => {
    function handleSessionExpired() {
      setUsuarioActual(null);
    }

    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

  function inicializarSesion() {
    try {
      setCargandoSesion(true);
      setErrorSesion("");

      const usuarioGuardado = getStoredSession();

      if (usuarioGuardado?.id && usuarioGuardado?.token) {
        setUsuarioActual(normalizarUsuarioSesion(usuarioGuardado));
      } else if (usuarioGuardado?.id) {
        clearStoredSession();
        setUsuarioActual(null);
      }
    } catch (err) {
      clearStoredSession();
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

    saveStoredSession(normalizado);
    setUsuarioActual(normalizado);

    return normalizado;
  }

  function cerrarSesionOperativa() {
    clearStoredSession();
    setUsuarioActual(null);
  }

  function seleccionarUsuario(usuario) {
    if (!usuario?.token) {
      clearStoredSession();
      setUsuarioActual(null);
      return;
    }

    const normalizado = normalizarUsuarioSesion(usuario);
    saveStoredSession(normalizado);
    setUsuarioActual(normalizado);
  }

  function puedeVerRuta(rolesPermitidos = []) {
    if (!usuarioActual) return false;
    if (!rolesPermitidos.length) return true;
    return rolesPermitidos.includes(usuarioActual.rol);
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
      rolLabel: LABELS_ROL[usuarioActual?.rol] ?? usuarioActual?.rol ?? "",

      esAdministrador: usuarioActual?.rol === "administrador",
      esEncargado: usuarioActual?.rol === "encargado",
      esOperador: usuarioActual?.rol === "operador",
      esMecanico: usuarioActual?.rol === "mecanico",

      puedeVerRuta,
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
    token: usuario.token ?? null,
    token_type: usuario.token_type ?? "bearer",
    expires_in: usuario.expires_in ?? null,
    activo: usuario.activo ?? true,
    id_sucursal: usuario.id_sucursal ?? SUCURSAL_DEFAULT.id,
  };
}
