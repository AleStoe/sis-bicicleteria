import { NavLink } from "react-router-dom";
import {
  Bike,
  Boxes,
  Calculator,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileSearch,
  Gauge,
  HandCoins,
  PackagePlus,
  Receipt,
  ShoppingCart,
  Tags,
  Users,
  Wrench,
  Settings2,
  PiggyBank,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";
import { sidebarContainerStyle } from "../../styles/layout/appLayoutStyles";
import {
  sidebarHeaderStyle,
  navSectionStyle,
  navGroupTitleStyle,
  navItemStyle,
  navItemActiveStyle,
  navIconStyle,
  navItemLabelStyle,
} from "../../styles/layout/sidebarStyles";

const groups = [
  { title: "Inicio", links: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Mostrador",
    links: [
      { to: "/ventas/nueva", label: "Nueva Venta", icon: ShoppingCart },
      { to: "/ventas", label: "Ventas", icon: Receipt },
      { to: "/reservas", label: "Reservas", icon: ClipboardList },
      { to: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    title: "Finanzas",
    links: [
      { to: "/caja", label: "Caja", icon: DollarSign },
      { to: "/pagos", label: "Pagos", icon: CreditCard },
      { to: "/gastos", label: "Gastos", icon: Receipt },
      { to: "/deudas", label: "Deudas", icon: FileSearch },
      { to: "/creditos", label: "Créditos", icon: HandCoins },
      { to: "/capital-retiros", label: "Capital y Retiros", icon: PiggyBank },
      { to: "/rentabilidad", label: "Rentabilidad", icon: BarChart3 },
    ],
  },
  {
    title: "Operación",
    links: [
      { to: "/stock", label: "Stock", icon: Boxes },
      { to: "/mercaderia/alta", label: "Alta mercadería", icon: PackagePlus },
      { to: "/mercaderia/bicicletas/alta", label: "Alta bicicletas", icon: Bike },
      { to: "/serializadas", label: "Serializadas", icon: ClipboardList },
      { to: "/catalogo", label: "Catálogo", icon: Tags },
      { to: "/precios", label: "Precios", icon: Calculator },
      { to: "/proveedores", label: "Proveedores", icon: HandCoins },
    ],
  },
  {
    title: "Taller y control",
    links: [
      { to: "/taller", label: "Taller", icon: Wrench },
      { to: "/servicios-taller", label: "Servicios Taller", icon: Wrench },
      { to: "/auditoria", label: "Auditoría", icon: Gauge },
      { to: "/configuracion-comercial", label: "Config. Comercial", icon: Settings2 },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  return (
    <aside style={sidebarContainerStyle}>
      <div style={sidebarHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              background: "linear-gradient(135deg, #FF6A00, #ea5f00)",
              boxShadow: "0 8px 22px rgba(255,106,0,.25)",
              flexShrink: 0,
            }}
          >
            <Bike size={22} color="white" strokeWidth={2.4} />
          </div>

          <div>
            <h2 style={{ margin: 0, lineHeight: 1.05, fontSize: 20 }}>
              Emprendimiento
              <br />
              Agus
            </h2>
            <div style={{ color: "#98a2b3", marginTop: 6, fontSize: 13 }}>
              ERP / POS
            </div>
          </div>
        </div>
      </div>

      <nav style={navSectionStyle}>
        {groups.map((group) => (
          <div key={group.title} style={{ display: "grid", gap: 6 }}>
            <div style={navGroupTitleStyle}>{group.title}</div>

            {group.links.map((link) => {
              const Icon = link.icon;

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onNavigate}
                  style={({ isActive }) => (isActive ? navItemActiveStyle : navItemStyle)}
                >
                  <Icon style={navIconStyle} size={18} strokeWidth={2.2} />
                  <span style={navItemLabelStyle}>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
