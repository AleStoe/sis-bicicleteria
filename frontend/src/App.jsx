import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import NuevaVentaPage from "./pages/NuevaVentaPage";
import NuevaVentaCheckoutPage from "./pages/NuevaVentaCheckoutPage";
import VentasListPage from "./pages/VentasListPage";
import VentaDetallePage from "./pages/VentaDetallePage";
import StockPage from "./pages/StockPage";
import PedidoCompraSugeridoPage from "./pages/PedidoCompraSugeridoPage";
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
import CategoriasCatalogoPage from "./pages/CategoriasCatalogoPage";
import AltaMercaderiaPage from "./pages/AltaMercaderiaPage";
import VentaCobroPage from "./pages/VentaCobroPage";
import ClienteBicicletaDetallePage from "./pages/ClienteBicicletaDetallePage";
import AltaBicicletaPage from "./pages/AltaBicicletaPage";
import CatalogoProductoDetallePage from "./pages/CatalogoProductoDetallePage";
import ConfiguracionComercialPage from "./pages/ConfiguracionComercialPage";
import ConfiguracionNegocioPage from "./pages/ConfiguracionNegocioPage";
import ServiciosPage from "./pages/ServiciosPage";
import CapitalRetirosPage from "./pages/CapitalRetirosPage";
import CapitalRetirosParticipantePerfilPage from "./pages/CapitalRetirosParticipantePerfilPage";
import RentabilidadPage from "./pages/RentabilidadPage";
import RentabilidadDiariaPage from "./pages/RentabilidadDiariaPage";
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
import BackupPage from "./pages/BackupPage";
import ArmadoPage from "./pages/ArmadoPage";
import ArmadoModeloDetallePage from "./pages/ArmadoModeloDetallePage";
import ArmadoConfiguracionDetallePage from "./pages/ArmadoConfiguracionDetallePage";
import ArmadoSimuladorPage from "./pages/ArmadoSimuladorPage";
import ArmadoOrdenesPage from "./pages/ArmadoOrdenesPage";
import ArmadoOrdenDetallePage from "./pages/ArmadoOrdenDetallePage";
import CorreccionesPage from "./pages/CorreccionesPage";

const ADMIN = ["administrador"];
const OPERACION = ["administrador", "encargado", "operador"];
const OPERACION_TALLER = ["administrador", "encargado", "operador", "mecanico"];
const TALLER = ["administrador", "encargado", "mecanico"];
const ADMIN_ENCARGADO = ["administrador", "encargado"];

const TITULOS_RUTA = [
  [/^\/ventas\/nueva$/, "Nueva venta"],
  [/^\/ventas\/checkout$/, "Checkout"],
  [/^\/ventas\/\d+\/cobro$/, "Cobro de venta"],
  [/^\/ventas\/\d+$/, "Detalle de venta"],
  [/^\/ventas$/, "Ventas"],
  [/^\/caja$/, "Caja"],
  [/^\/clientes\/nuevo$/, "Nuevo cliente"],
  [/^\/clientes\/\d+\/editar$/, "Editar cliente"],
  [/^\/clientes\/\d+\/bicicletas\/\d+$/, "Bicicleta del cliente"],
  [/^\/clientes\/\d+$/, "Detalle de cliente"],
  [/^\/clientes$/, "Clientes"],
  [/^\/taller\/nueva$/, "Nueva orden de taller"],
  [/^\/taller\/\d+$/, "Orden de taller"],
  [/^\/taller$/, "Ordenes de taller"],
  [/^\/agenda-taller$/, "Agenda taller"],
  [/^\/servicios-taller$/, "Servicios taller"],
  [/^\/deudas\/\d+$/, "Detalle de deuda"],
  [/^\/deudas$/, "Deudas"],
  [/^\/pagos$/, "Pagos"],
  [/^\/creditos\/\d+$/, "Detalle de credito"],
  [/^\/creditos$/, "Creditos"],
  [/^\/reservas\/nueva$/, "Nueva reserva"],
  [/^\/reservas\/\d+$/, "Detalle de reserva"],
  [/^\/reservas$/, "Reservas"],
  [/^\/stock\/pedido-compra$/, "Pedido de compra"],
  [/^\/stock$/, "Stock"],
  [/^\/armado\/configuraciones\/\d+\/simular$/, "Simulador de armado"],
  [/^\/armado\/configuraciones\/\d+$/, "Configuracion de armado"],
  [/^\/armado\/ordenes\/\d+$/, "Orden de armado"],
  [/^\/armado\/ordenes$/, "Ordenes de armado"],
  [/^\/armado\/modelos\/\d+$/, "Modelo de armado"],
  [/^\/armado$/, "Armado"],
  [/^\/serializadas$/, "Bicicletas"],
  [/^\/inventario-fisico$/, "Inventario fisico"],
  [/^\/alertas-operativas$/, "Salud operativa"],
  [/^\/salud-operativa$/, "Salud operativa"],
  [/^\/correcciones$/, "Correcciones"],
  [/^\/etiquetas$/, "Etiquetas"],
  [/^\/catalogo\/categorias$/, "Categorias"],
  [/^\/catalogo\/productos\/\d+$/, "Detalle de catalogo"],
  [/^\/catalogo$/, "Catalogo"],
  [/^\/mercaderia\/alta$/, "Alta mercaderia"],
  [/^\/mercaderia\/bicicletas\/alta$/, "Alta bicicletas"],
  [/^\/proveedores$/, "Proveedores"],
  [/^\/precios$/, "Precios"],
  [/^\/cotizaciones\/\d+$/, "Detalle de cotizacion"],
  [/^\/cotizaciones$/, "Cotizaciones"],
  [/^\/configuracion-comercial$/, "Config. comercial"],
  [/^\/configuracion-negocio$/, "Config. negocio"],
  [/^\/dashboard$/, "Dashboard admin"],
  [/^\/admin\/dashboard$/, "Dashboard admin"],
  [/^\/auditoria$/, "Auditoria"],
  [/^\/capital-retiros\/participantes\/\d+$/, "Perfil de capital"],
  [/^\/capital-retiros$/, "Capital y retiros"],
  [/^\/rentabilidad\/diaria$/, "Rentabilidad diaria"],
  [/^\/rentabilidad$/, "Rentabilidad"],
  [/^\/gastos$/, "Gastos"],
  [/^\/usuarios$/, "Usuarios"],
  [/^\/backups$/, "Backups"],
];

function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    const titulo =
      TITULOS_RUTA.find(([patron]) => patron.test(location.pathname))?.[1] ||
      "Emprendimiento Agus";
    document.title =
      titulo === "Emprendimiento Agus"
        ? titulo
        : `${titulo} | Emprendimiento Agus`;
  }, [location.pathname]);

  return null;
}

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
      <PageTitle />
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
            path="/stock/pedido-compra"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <PedidoCompraSugeridoPage />
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
            path="/armado"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ArmadoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/armado/modelos/:modeloId"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ArmadoModeloDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/armado/configuraciones/:configuracionId"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ArmadoConfiguracionDetallePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/armado/configuraciones/:configuracionId/simular"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ArmadoSimuladorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/armado/ordenes"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ArmadoOrdenesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/armado/ordenes/:ordenId"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <ArmadoOrdenDetallePage />
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
            path="/salud-operativa"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <AlertasOperativasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/correcciones"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <CorreccionesPage />
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
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
                <CatalogoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalogo/categorias"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN_ENCARGADO}>
                <CategoriasCatalogoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/catalogo/productos/:productoId"
            element={
              <ProtectedRoute rolesPermitidos={OPERACION_TALLER}>
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
            path="/configuracion-negocio"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <ConfiguracionNegocioPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
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
            path="/rentabilidad/diaria"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <RentabilidadDiariaPage />
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
            path="/backups"
            element={
              <ProtectedRoute rolesPermitidos={ADMIN}>
                <BackupPage />
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
