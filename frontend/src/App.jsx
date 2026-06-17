import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import NuevaVentaPage from "./pages/NuevaVentaPage";
import NuevaVentaCheckoutPage from "./pages/NuevaVentaCheckoutPage";
import VentasListPage from "./pages/VentasListPage";
import VentaDetallePage from "./pages/VentaDetallePage";
import StockPage from "./pages/StockPage";
import CajaPage from "./pages/CajaPage";
import ClientesListPage from "./pages/ClientesListPage";
import ClienteDetallePage from "./pages/ClienteDetallePage";
import ClienteFormPage from "./pages/ClienteFormPage";
import TallerListPage from "./pages/TallerListPage";
import TallerNuevaOrdenPage from "./pages/TallerNuevaOrdenPage";
import TallerDetallePage from "./pages/TallerDetallePage";
import DeudasListPage from "./pages/DeudasListPage";
import DeudaDetallePage from "./pages/DeudaDetallePage";
import PagosPage from "./pages/PagosPage";
import CreditosListPage from "./pages/CreditosListPage";
import CreditoDetallePage from "./pages/CreditoDetallePage";
import ReservasListPage from "./pages/ReservasListPage";
import NuevaReservaPage from "./pages/NuevaReservaPage";
import ReservaDetallePage from "./pages/ReservaDetallePage";
import AuditoriaPage from "./pages/AuditoriaPage";
import BicicletasSerializadasPage from "./pages/BicicletasSerializadasPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import PreciosPage from "./pages/PreciosPage";
import CatalogoPage from "./pages/CatalogoPage";
import AltaMercaderiaPage from "./pages/AltaMercaderiaPage";
import VentaCobroPage from "./pages/VentaCobroPage";
import ClienteBicicletaDetallePage from "./pages/ClienteBicicletaDetallePage";
import AltaBicicletaPage from "./pages/AltaBicicletaPage";
import CatalogoProductoDetallePage from "./pages/CatalogoProductoDetallePage";
import ConfiguracionComercialPage from "./pages/ConfiguracionComercialPage";
import ServiciosPage from "./pages/ServiciosPage";
import CapitalRetirosPage from "./pages/CapitalRetirosPage";
import CapitalRetirosParticipantePerfilPage from "./pages/CapitalRetirosParticipantePerfilPage";
import RentabilidadPage from "./pages/RentabilidadPage";
import DashboardPage from "./pages/DashboardPage";
import GastosPage from "./pages/GastosPage";
import UsuariosPage from "./pages/UsuariosPage";
import LoginPage from "./pages/LoginPage";
import { useSession } from "./context/SessionContext";
import AgendaTallerPage from "./pages/AgendaTallerPage";
import CotizacionesListPage from "./pages/CotizacionesListPage";
import CotizacionDetallePage from "./pages/CotizacionDetallePage";
import EtiquetasPage from "./pages/EtiquetasPage";
import InventarioFisicoPage from "./pages/InventarioFisicoPage";
import AlertasOperativasPage from "./pages/AlertasOperativasPage";

const ADMIN = ["administrador"];
const OPERACION = ["administrador", "encargado", "operador"];
const OPERACION_TALLER = ["administrador", "encargado", "operador", "mecanico"];
const TALLER = ["administrador", "encargado", "mecanico"];
const ADMIN_ENCARGADO = ["administrador", "encargado"];

export default function App() {
  const { usuarioActual, cargandoSesion } = useSession();

  if (cargandoSesion) {
    return <div style={styles.loading}>Cargando sesión...</div>;
  }

  if (!usuarioActual) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/ventas/nueva" replace />} />

          <Route
            path="/ventas/nueva"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <NuevaVentaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/checkout"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <NuevaVentaCheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <VentasListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/:ventaId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <VentaDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/:ventaId/cobro"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <VentaCobroPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cotizaciones"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <CotizacionesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cotizaciones/:cotizacionId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <CotizacionDetallePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stock"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <StockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/serializadas"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <BicicletasSerializadasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventario-fisico"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <InventarioFisicoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alertas-operativas"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <AlertasOperativasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/etiquetas"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <EtiquetasPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/caja"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <CajaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <ClientesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:clienteId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <ClienteDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/nuevo"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <ClienteFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:clienteId/editar"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <ClienteFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:clienteId/bicicletas/:bicicletaId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <ClienteBicicletaDetallePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/taller"
            element={
              <ProtectedRoute rolesPermitidos={TALLER}>
                <TallerListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/taller/nueva"
            element={
              <ProtectedRoute rolesPermitidos={TALLER}>
                <TallerNuevaOrdenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/taller/:ordenId"
            element={
              <ProtectedRoute rolesPermitidos={TALLER}>
                <TallerDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/servicios-taller"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ServiciosPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/deudas"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <DeudasListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deudas/:deudaId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <DeudaDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pagos"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <PagosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/creditos"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <CreditosListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/creditos/:creditoId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <CreditoDetallePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reservas"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <ReservasListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reservas/nueva"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <NuevaReservaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reservas/:reservaId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION}>
                <ReservaDetallePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/proveedores"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ProveedoresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/precios"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <PreciosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalogo"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <CatalogoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalogo/productos/:productoId"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <CatalogoProductoDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mercaderia/alta"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <AltaMercaderiaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mercaderia/bicicletas/alta"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <AltaBicicletaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracion-comercial"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <ConfiguracionComercialPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/auditoria"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <AuditoriaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capital-retiros"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <CapitalRetirosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capital-retiros/participantes/:participanteId"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <CapitalRetirosParticipantePerfilPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rentabilidad"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <RentabilidadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gastos"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <GastosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <UsuariosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agenda-taller"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <AgendaTallerPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/ventas/nueva" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
    
  );
}

const styles = {
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f1f5f9",
    color: "#0f172a",
    fontWeight: 900,
  },
};
