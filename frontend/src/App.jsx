import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
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
import SeleccionUsuarioPage from "./pages/SeleccionUsuarioPage";
import { useSession } from "./context/SessionContext";

export default function App() {
  const { usuarioActual, cargandoSesion } = useSession();

  if (cargandoSesion) {
    return <div style={styles.loading}>Cargando sesión operativa...</div>;
  }

  if (!usuarioActual) {
    return <SeleccionUsuarioPage />;
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/ventas/nueva" replace />} />
          <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
          <Route path="/ventas/checkout" element={<NuevaVentaCheckoutPage />} />
          <Route path="/ventas" element={<VentasListPage />} />
          <Route path="/ventas/:ventaId" element={<VentaDetallePage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/taller" element={<TallerListPage />} />
          <Route path="/taller/nueva" element={<TallerNuevaOrdenPage />} />
          <Route path="/taller/:ordenId" element={<TallerDetallePage />} />
          <Route path="/clientes" element={<ClientesListPage />} />
          <Route path="/clientes/:clienteId" element={<ClienteDetallePage />} />
          <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
          <Route path="/clientes/:clienteId/editar" element={<ClienteFormPage />} />
          <Route path="/deudas" element={<DeudasListPage />} />
          <Route path="/deudas/:deudaId" element={<DeudaDetallePage />} />
          <Route path="/pagos" element={<PagosPage />} />
          <Route path="/creditos" element={<CreditosListPage />} />
          <Route path="/creditos/:creditoId" element={<CreditoDetallePage />} />
          <Route path="/reservas" element={<ReservasListPage />} />
          <Route path="/reservas/nueva" element={<NuevaReservaPage />} />
          <Route path="/reservas/:reservaId" element={<ReservaDetallePage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/serializadas" element={<BicicletasSerializadasPage />} />
          <Route path="/proveedores" element={<ProveedoresPage />} />
          <Route path="/precios" element={<PreciosPage />} />
          <Route path="/catalogo" element={<CatalogoPage />} />
          <Route path="/mercaderia/alta" element={<AltaMercaderiaPage />} />
          <Route path="/ventas/:ventaId/cobro" element={<VentaCobroPage />} />
          <Route path="/clientes/:clienteId/bicicletas/:bicicletaId" element={<ClienteBicicletaDetallePage />}/>
          <Route path="/mercaderia/bicicletas/alta" element={<AltaBicicletaPage />} />
          <Route path="/catalogo/productos/:productoId" element={<CatalogoProductoDetallePage />}/>
          <Route path="/configuracion-comercial" element={<ConfiguracionComercialPage />}/>
          <Route path="/servicios-taller" element={<ServiciosPage />} />
          <Route path="/capital-retiros" element={<CapitalRetirosPage />} />
          <Route path="/capital-retiros/participantes/:participanteId" element={<CapitalRetirosParticipantePerfilPage />}/>
          <Route path="/rentabilidad" element={<RentabilidadPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/gastos" element={<GastosPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
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