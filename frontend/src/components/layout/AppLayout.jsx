import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import {
  appShellStyle,
  mainContainerStyle,
  topbarStyle,
  contentStyle,
  logoStyle,
  subtleStyle,
} from "../../styles/layout/appLayoutStyles";

export default function AppLayout({ children }) {
  return (
    <div style={appShellStyle}>
      <Sidebar />

      <div style={mainContainerStyle}>
        <header style={topbarStyle}>
          <div>
            <div style={logoStyle}>Emprendimiento Agus ERP</div>
            <div style={subtleStyle}>Sistema de gestión integral</div>
          </div>

          <div style={subtleStyle}>
            Bicicletería · Taller · Caja · Stock
          </div>
        </header>

        <main style={contentStyle}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
