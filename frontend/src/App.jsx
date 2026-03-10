import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import NuevaVentaPage from "./pages/NuevaVentaPage";
import VentasListPage from "./pages/VentasListPage";
import VentaDetallePage from "./pages/VentaDetallePage";
import StockPage from "./pages/StockPage";

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
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
