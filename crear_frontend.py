from pathlib import Path

BASE_DIR = Path.cwd() / "frontend"

DIRS = [
    "src/pages",
    "src/components/layout",
    "src/components/ventas",
    "src/components/stock",
    "src/components/common",
    "src/services",
    "src/utils",
    "src/styles",
]

FILES = {
    "src/main.jsx": """import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
""",
    "src/App.jsx": """import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
""",
    "src/pages/NuevaVentaPage.jsx": """export default function NuevaVentaPage() {
  return <div>Nueva Venta</div>;
}
""",
    "src/pages/VentasListPage.jsx": """export default function VentasListPage() {
  return <div>Listado de Ventas</div>;
}
""",
    "src/pages/VentaDetallePage.jsx": """export default function VentaDetallePage() {
  return <div>Detalle de Venta</div>;
}
""",
    "src/pages/StockPage.jsx": """export default function StockPage() {
  return <div>Stock</div>;
}
""",
    "src/components/layout/AppLayout.jsx": """import Sidebar from "./Sidebar";

export default function AppLayout({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "24px" }}>{children}</main>
    </div>
  );
}
""",
    "src/components/layout/Sidebar.jsx": """import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside
      style={{
        width: "220px",
        borderRight: "1px solid #ddd",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <h2>Sis Bicicletería</h2>
      <nav style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Link to="/ventas/nueva">Nueva venta</Link>
        <Link to="/ventas">Ventas</Link>
        <Link to="/stock">Stock</Link>
      </nav>
    </aside>
  );
}
""",
    "src/components/ventas/BuscadorVariantes.jsx": """export default function BuscadorVariantes() {
  return <div>BuscadorVariantes</div>;
}
""",
    "src/components/ventas/ResultadosBusqueda.jsx": """export default function ResultadosBusqueda() {
  return <div>ResultadosBusqueda</div>;
}
""",
    "src/components/ventas/CarritoVenta.jsx": """export default function CarritoVenta() {
  return <div>CarritoVenta</div>;
}
""",
    "src/components/ventas/ResumenVenta.jsx": """export default function ResumenVenta() {
  return <div>ResumenVenta</div>;
}
""",
    "src/components/ventas/VentaItemsTable.jsx": """export default function VentaItemsTable() {
  return <div>VentaItemsTable</div>;
}
""",
    "src/components/ventas/AnularVentaButton.jsx": """export default function AnularVentaButton() {
  return <button>Anular venta</button>;
}
""",
    "src/components/stock/StockTable.jsx": """export default function StockTable() {
  return <div>StockTable</div>;
}
""",
    "src/components/common/ErrorMessage.jsx": """export default function ErrorMessage({ message }) {
  if (!message) return null;
  return <p style={{ color: "red" }}>{message}</p>;
}
""",
    "src/components/common/LoadingSpinner.jsx": """export default function LoadingSpinner() {
  return <p>Cargando...</p>;
}
""",
    "src/services/api.js": """const API_BASE_URL = "http://127.0.0.1:8000";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(data?.detail || "Error en la API");
  }

  return data;
}
""",
    "src/services/ventasService.js": """import { apiRequest } from "./api";

export function crearVenta(payload) {
  return apiRequest("/ventas/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listarVentas() {
  return apiRequest("/ventas/");
}

export function obtenerVenta(ventaId) {
  return apiRequest(`/ventas/${ventaId}`);
}

export function anularVenta(ventaId, payload) {
  return apiRequest(`/ventas/${ventaId}/anular`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
""",
    "src/services/catalogoService.js": """import { apiRequest } from "./api";

export function listarVariantes() {
  return apiRequest("/catalogo/variantes");
}
""",
    "src/services/stockService.js": """import { apiRequest } from "./api";

export function listarStock() {
  return apiRequest("/stock/");
}
""",
    "src/utils/currency.js": """export function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
""",
    "src/styles/globals.css": """* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}
""",
    "index.html": """<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sis Bicicletería Frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
""",
    "package.json": """{
  "name": "sis-bicicleteria-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.3",
    "vite": "^5.4.10"
  }
}
""",
    "vite.config.js": """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
""",
}


def ensure_dirs():
    for d in DIRS:
        path = BASE_DIR / d
        path.mkdir(parents=True, exist_ok=True)
        print(f"[DIR]  {path}")


def write_files():
    for rel_path, content in FILES.items():
        file_path = BASE_DIR / rel_path
        file_path.parent.mkdir(parents=True, exist_ok=True)

        if file_path.exists():
            print(f"[SKIP] {file_path} ya existe")
            continue

        file_path.write_text(content, encoding="utf-8")
        print(f"[FILE] {file_path}")


def main():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    ensure_dirs()
    write_files()
    print("\\nListo. Estructura creada en:", BASE_DIR)


if __name__ == "__main__":
    main()