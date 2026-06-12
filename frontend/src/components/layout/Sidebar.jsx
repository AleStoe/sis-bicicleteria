import { NavLink } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
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
  UserCog,
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

const ADMIN = ["administrador"];
const OPERACION = ["administrador", "encargado", "operador"];
const OPERACION_TALLER = ["administrador", "encargado", "operador", "mecanico"];
const TALLER = ["administrador", "encargado", "mecanico"];
const ADMIN_ENCARGADO = ["administrador", "encargado"];

const groups = [
  {
    title: "Inicio",
    links: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ADMIN_ENCARGADO },
    ],
  },
  {
    title: "Mostrador",
    links: [
      { to: "/ventas/nueva", label: "Nueva Venta", icon: ShoppingCart, roles: OPERACION },
      { to: "/ventas", label: "Ventas", icon: Receipt, roles: OPERACION },
      { to: "/reservas", label: "Reservas", icon: ClipboardList, roles: OPERACION },
      { to: "/clientes", label: "Clientes", icon: Users, roles: OPERACION },
    ],
  },
  {
    title: "Finanzas",
    links: [
      { to: "/caja", label: "Caja", icon: DollarSign, roles: OPERACION },
      { to: "/pagos", label: "Pagos", icon: CreditCard, roles: OPERACION },
      { to: "/gastos", label: "Gastos", icon: Receipt, roles: ADMIN_ENCARGADO },
      { to: "/deudas", label: "Deudas", icon: FileSearch, roles: OPERACION },
      { to: "/creditos", label: "Créditos", icon: HandCoins, roles: OPERACION },
      { to: "/capital-retiros", label: "Capital y Retiros", icon: PiggyBank, roles: ADMIN },
      { to: "/rentabilidad", label: "Rentabilidad", icon: BarChart3, roles: ADMIN },
    ],
  },
  {
    title: "Operación",
    links: [
      { to: "/stock", label: "Stock", icon: Boxes, roles: OPERACION_TALLER },
      { to: "/mercaderia/alta", label: "Alta mercadería", icon: PackagePlus, roles: ADMIN_ENCARGADO },
      { to: "/mercaderia/bicicletas/alta", label: "Alta bicicletas", icon: Bike, roles: ADMIN_ENCARGADO },
      { to: "/serializadas", label: "Serializadas", icon: ClipboardList, roles: OPERACION_TALLER },
      { to: "/catalogo", label: "Catálogo", icon: Tags, roles: ADMIN_ENCARGADO },
      { to: "/precios", label: "Precios", icon: Calculator, roles: ADMIN_ENCARGADO },
      { to: "/proveedores", label: "Proveedores", icon: HandCoins, roles: ADMIN_ENCARGADO },
    ],
  },
  {
    title: "Taller y control",
    links: [
      { to: "/taller", label: "Taller", icon: Wrench, roles: TALLER },
      { to: "/servicios-taller", label: "Servicios Taller", icon: Wrench, roles: ADMIN_ENCARGADO },
      { to: "/auditoria", label: "Auditoría", icon: Gauge, roles: ADMIN },
      { to: "/usuarios", label: "Usuarios", icon: UserCog, roles: ADMIN },
      { to: "/configuracion-comercial", label: "Config. Comercial", icon: Settings2, roles: ADMIN },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const { rolActual } = useSession();

  const gruposVisibles = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => link.roles.includes(rolActual)),
    }))
    .filter((group) => group.links.length > 0);

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
        {gruposVisibles.map((group) => (
          <div key={group.title} style={{ display: "grid", gap: 6 }}>
            <div style={navGroupTitleStyle}>{group.title}</div>

            {group.links.map((link) => {
              const Icon = link.icon;

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onNavigate}
                  style={({ isActive }) =>
                    isActive ? navItemActiveStyle : navItemStyle
                  }
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