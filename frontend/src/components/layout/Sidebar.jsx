import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../../context/SessionContext";
import {
  BarChart3,
  Bike,
  Boxes,
  Calculator,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileSearch,
  FileText,
  Gauge,
  HandCoins,
  LayoutDashboard,
  PackagePlus,
  PiggyBank,
  Receipt,
  Settings2,
  ShoppingCart,
  Tags,
  UserCog,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { sidebarContainerStyle } from "../../styles/layout/appLayoutStyles";
import {
  navGroupTitleStyle,
  navIconStyle,
  navItemActiveStyle,
  navItemLabelStyle,
  navItemStyle,
  navSectionStyle,
  sidebarHeaderStyle,
} from "../../styles/layout/sidebarStyles";
import { obtenerAlertasOperativas } from "../../services/alertasOperativasService";

const ADMIN = ["administrador"];
const OPERACION = ["administrador", "encargado", "operador"];
const OPERACION_TALLER = ["administrador", "encargado", "operador", "mecanico"];
const TALLER = ["administrador", "encargado", "mecanico"];
const ADMIN_ENCARGADO = ["administrador", "encargado"];

const groups = [
  {
    title: "Acciones rapidas",
    links: [
      { to: "/ventas/nueva", label: "Nueva Venta", icon: ShoppingCart, roles: OPERACION, highlight: true },
      { to: "/agenda-taller", label: "Nuevo turno taller", icon: CalendarDays, roles: OPERACION_TALLER },
      { to: "/clientes/nuevo", label: "Nuevo cliente", icon: UserPlus, roles: OPERACION },
    ],
  },
  {
    title: "Operacion",
    links: [
      { to: "/ventas", label: "Ventas", icon: Receipt, roles: OPERACION },
      { to: "/caja", label: "Caja", icon: DollarSign, roles: OPERACION },
      { to: "/clientes", label: "Clientes", icon: Users, roles: OPERACION },
      { to: "/cotizaciones", label: "Cotizaciones", icon: FileText, roles: OPERACION_TALLER },
      { to: "/reservas", label: "Reservas", icon: ClipboardList, roles: OPERACION },
      { to: "/pagos", label: "Pagos", icon: CreditCard, roles: OPERACION },
      { to: "/etiquetas", label: "Etiquetas", icon: Tags, roles: OPERACION_TALLER },
    ],
  },
  {
    title: "Taller",
    links: [
      { to: "/agenda-taller", label: "Agenda Taller", icon: CalendarDays, roles: OPERACION_TALLER },
      { to: "/taller", label: "Ordenes Taller", icon: Wrench, roles: TALLER },
      { to: "/serializadas", label: "Bicicletas", icon: Bike, roles: OPERACION_TALLER },
      { to: "/servicios-taller", label: "Servicios Taller", icon: Wrench, roles: ADMIN_ENCARGADO },
    ],
  },
  {
    title: "Stock",
    links: [
      { to: "/stock", label: "Stock", icon: Boxes, roles: OPERACION_TALLER },
      { to: "/catalogo", label: "Catalogo", icon: Tags, roles: ADMIN_ENCARGADO },
      { to: "/catalogo/categorias", label: "Categorias", icon: Tags, roles: ADMIN_ENCARGADO },
      { to: "/mercaderia/alta", label: "Ingresar Mercaderia", icon: PackagePlus, roles: ADMIN_ENCARGADO },
      { to: "/inventario-fisico", label: "Inventario Fisico", icon: ClipboardList, roles: ADMIN_ENCARGADO },
      { to: "/serializadas", label: "Serializadas", icon: ClipboardList, roles: OPERACION_TALLER },
      { to: "/precios", label: "Precios", icon: Calculator, roles: ADMIN_ENCARGADO },
      { to: "/proveedores", label: "Proveedores", icon: HandCoins, roles: ADMIN_ENCARGADO },
      { to: "/mercaderia/bicicletas/alta", label: "Alta bicicletas", icon: Bike, roles: ADMIN_ENCARGADO },
    ],
  },
  {
    title: "Control",
    links: [
      { to: "/alertas-operativas", label: "Alertas Operativas", icon: Gauge, roles: OPERACION_TALLER, badge: "alertas" },
      { to: "/admin/dashboard", label: "Dashboard Admin", icon: LayoutDashboard, roles: ADMIN },
      { to: "/gastos", label: "Gastos", icon: Receipt, roles: ADMIN_ENCARGADO },
      { to: "/deudas", label: "Deudas", icon: FileSearch, roles: OPERACION },
      { to: "/creditos", label: "Creditos", icon: HandCoins, roles: OPERACION },
      { to: "/rentabilidad", label: "Rentabilidad", icon: BarChart3, roles: ADMIN },
      { to: "/capital-retiros", label: "Capital y Retiros", icon: PiggyBank, roles: ADMIN },
    ],
  },
  {
    title: "Sistema",
    links: [
      { to: "/usuarios", label: "Usuarios", icon: UserCog, roles: ADMIN },
      { to: "/auditoria", label: "Auditoria", icon: Gauge, roles: ADMIN },
      { to: "/configuracion-negocio", label: "Config. Negocio", icon: Settings2, roles: ADMIN },
      { to: "/configuracion-comercial", label: "Config. Comercial", icon: Settings2, roles: ADMIN },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const { rolActual } = useSession();
  const [alertasCount, setAlertasCount] = useState(0);

  const puedeVerAlertas = OPERACION_TALLER.includes(rolActual);

  useEffect(() => {
    let activo = true;

    async function cargarBadgeAlertas() {
      if (!puedeVerAlertas) {
        setAlertasCount(0);
        return;
      }

      try {
        const data = await obtenerAlertasOperativas();
        if (activo) setAlertasCount(contarAlertasOperativas(data));
      } catch {
        if (activo) setAlertasCount(0);
      }
    }

    cargarBadgeAlertas();

    return () => {
      activo = false;
    };
  }, [puedeVerAlertas]);

  const gruposVisibles = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          links: group.links.filter((link) => link.roles.includes(rolActual)),
        }))
        .filter((group) => group.links.length > 0),
    [rolActual],
  );

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
              const badgeValue = link.badge === "alertas" ? alertasCount : 0;

              return (
                <NavLink
                  key={`${group.title}-${link.to}-${link.label}`}
                  to={link.to}
                  onClick={onNavigate}
                  style={({ isActive }) => getNavItemStyle(link, isActive)}
                >
                  <Icon style={navIconStyle} size={18} strokeWidth={2.2} />
                  <span style={navItemLabelStyle}>{link.label}</span>
                  {badgeValue > 0 ? (
                    <span style={badgeStyle}>{badgeValue > 99 ? "99+" : badgeValue}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function contarAlertasOperativas(data) {
  if (!data || typeof data !== "object") return 0;

  return [
    data.bicis_listas,
    data.reservas_vencidas,
    data.deudas_vencidas,
    data.taller_atrasado,
    data.stock_critico,
  ].reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
}

function getNavItemStyle(link, isActive) {
  const base = isActive ? navItemActiveStyle : navItemStyle;

  if (!link.highlight || isActive) {
    return base;
  }

  return {
    ...base,
    background: "rgba(255, 106, 0, 0.14)",
    border: "1px solid rgba(255, 106, 0, 0.45)",
    color: "#fff7ed",
    fontWeight: 900,
  };
}

const badgeStyle = {
  marginLeft: "auto",
  minWidth: 22,
  height: 22,
  padding: "0 7px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ef4444",
  color: "white",
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1,
};
