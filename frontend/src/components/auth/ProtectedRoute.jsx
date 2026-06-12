import { Navigate } from "react-router-dom";
import { useSession } from "../../context/SessionContext";

export default function ProtectedRoute({ children, rolesPermitidos = [] }) {
  const { usuarioActual, cargandoSesion, rolActual } = useSession();

  if (cargandoSesion) {
    return null;
  }

  if (!usuarioActual) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rolActual)) {
    return <Navigate to={getHomePorRol(rolActual)} replace />;
  }

  return children;
}

function getHomePorRol(rol) {
  if (rol === "mecanico") return "/taller";
  return "/ventas/nueva";
}