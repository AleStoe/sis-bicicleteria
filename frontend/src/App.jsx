import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import NuevaVentaPage from "./pages/NuevaVentaPage";
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

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/ventas/nueva" replace />} />
          <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
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
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}