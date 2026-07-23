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
  DatabaseBackup,
  DollarSign,
  FileSearch,
  FileText,
  Gauge,
  HandCoins,
  LayoutDashboard,
  PackagePlus,
  PiggyBank,
  Receipt,
  Search,
  ShieldCheck,
  Settings2,
  ShoppingCart,
  Tags,
  UserCog,
  UserPlus,
  Users,
  Wrench,
  X,
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
      { to: "/catalogo", label: "Catalogo", icon: Tags, roles: OPERACION_TALLER },
      { to: "/taller", label: "Ordenes Taller", icon: Wrench, roles: TALLER },
      { to: "/mercaderia/alta", label: "Ingresar Mercaderia", icon: PackagePlus, roles: ADMIN_ENCARGADO },
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
      { to: "/stock/pedido-compra", label: "Pedido sugerido", icon: ShoppingCart, roles: ADMIN_ENCARGADO },
      { to: "/catalogo", label: "Catalogo", icon: Tags, roles: OPERACION_TALLER },
      { to: "/catalogo/categorias", label: "Categorias", icon: Tags, roles: ADMIN_ENCARGADO },
      { to: "/mercaderia/alta", label: "Ingresar Mercaderia", icon: PackagePlus, roles: ADMIN_ENCARGADO },
      { to: "/inventario-fisico", label: "Inventario Fisico", icon: ClipboardList, roles: ADMIN_ENCARGADO },
      { to: "/armado", label: "Armado bicis", icon: Bike, roles: ADMIN_ENCARGADO },
      { to: "/armado/ordenes", label: "Ordenes armado", icon: ClipboardList, roles: ADMIN_ENCARGADO },
      { to: "/serializadas", label: "Serializadas", icon: ClipboardList, roles: OPERACION_TALLER },
      { to: "/precios", label: "Precios", icon: Calculator, roles: ADMIN_ENCARGADO },
      { to: "/proveedores", label: "Proveedores", icon: HandCoins, roles: ADMIN_ENCARGADO },
      { to: "/mercaderia/bicicletas/alta", label: "Alta bicicletas", icon: Bike, roles: ADMIN_ENCARGADO },
    ],
  },
  {
    title: "Control",
    links: [
      { to: "/salud-operativa", label: "Salud Operativa", icon: Gauge, roles: OPERACION_TALLER, badge: "alertas" },
      { to: "/correcciones", label: "Correcciones", icon: Wrench, roles: ADMIN },
      { to: "/postventa", label: "Postventa", icon: ShieldCheck, roles: ADMIN_ENCARGADO },
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
      { to: "/backups", label: "Backups", icon: DatabaseBackup, roles: ADMIN },
      { to: "/configuracion-negocio", label: "Config. Negocio", icon: Settings2, roles: ADMIN },
      { to: "/configuracion-comercial", label: "Config. Comercial", icon: Settings2, roles: ADMIN },
    ],
  },
];

export default function Sidebar({ onNavigate, mobile = false }) {
  const { rolActual } = useSession();
  const [alertasCount, setAlertasCount] = useState(0);
  const [query, setQuery] = useState("");

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
    () => {
      const texto = normalizarBusqueda(query);

      return groups
        .map((group) => {
          const coincideGrupo = normalizarBusqueda(group.title).includes(texto);
          const linksPermitidos = group.links.filter((link) =>
            link.roles.includes(rolActual)
          );

          return {
            ...group,
            links:
              !texto || coincideGrupo
                ? linksPermitidos
                : linksPermitidos.filter((link) =>
                    normalizarBusqueda(link.label).includes(texto)
                  ),
          };
        })
        .filter((group) => group.links.length > 0);
    },
    [query, rolActual],
  );
  const buscando = normalizarBusqueda(query).length > 0;
  const cantidadResultados = gruposVisibles.reduce(
    (total, group) => total + group.links.length,
    0
  );

  return (
    <aside style={sidebarContainerStyle(mobile)}>
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

      <label
        style={{
          ...searchStyle,
          ...(buscando ? searchActiveStyle : {}),
        }}
      >
        <Search size={17} strokeWidth={2.2} style={searchIconStyle} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar módulo..."
          aria-label="Buscar módulo"
          style={searchInputStyle}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
            style={clearSearchButtonStyle}
          >
            <X size={15} />
          </button>
        ) : null}
      </label>

      <nav className="app-sidebar-nav" style={navSectionStyle}>
        {gruposVisibles.length ? (
          <>
            {buscando ? (
              <div style={resultsSummaryStyle}>
                <Search size={14} />
                <span>
                  {cantidadResultados} {cantidadResultados === 1 ? "resultado" : "resultados"}
                </span>
              </div>
            ) : null}

            {gruposVisibles.map((group) => (
              <div
                key={group.title}
                style={{
                  display: "grid",
                  gap: 5,
                  minWidth: 0,
                  width: "100%",
                  ...(buscando ? searchGroupStyle : {}),
                }}
              >
                <div
                  style={{
                    ...navGroupTitleStyle,
                    ...(buscando ? searchGroupTitleStyle : {}),
                  }}
                >
                  {group.title}
                </div>

                {group.links.map((link) => {
                  const Icon = link.icon;
                  const badgeValue = link.badge === "alertas" ? alertasCount : 0;

                  return (
                    <NavLink
                      key={`${group.title}-${link.to}-${link.label}`}
                      to={link.to}
                      onClick={onNavigate}
                      style={({ isActive }) =>
                        getNavItemStyle(link, isActive, buscando)
                      }
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
          </>
        ) : (
          <div style={emptySearchStyle}>No hay módulos con ese nombre.</div>
        )}
      </nav>
    </aside>
  );
}

function normalizarBusqueda(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function contarAlertasOperativas(data) {
  if (!data || typeof data !== "object") return 0;

  return [
    data.bicis_listas,
    data.reservas_vencidas,
    data.deudas_vencidas,
    data.taller_atrasado,
    data.stock_critico,
    data.ventas_cobradas_no_entregadas,
    data.ventas_saldo_sin_deuda,
    data.ventas_saldo_desincronizado,
    data.pagos_revertidos_hoy,
    data.cajas_abiertas_anteriores,
    data.productos_maestros_incompletos,
    data.maestros_inactivos_en_uso,
  ].reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
}

function getNavItemStyle(link, isActive, buscando = false) {
  const base = isActive ? navItemActiveStyle : navItemStyle;

  if (!link.highlight || isActive) {
    return buscando && !isActive
      ? {
          ...base,
          background: "rgba(255,255,255,.045)",
          borderColor: "transparent",
        }
      : base;
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

const searchStyle = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 8,
  minHeight: 42,
  marginBottom: 10,
  padding: "0 9px",
  border: "1px solid rgba(255,255,255,.16)",
  borderRadius: 8,
  background: "rgba(255,255,255,.08)",
  flexShrink: 0,
};

const searchIconStyle = {
  color: "#98a2b3",
  flexShrink: 0,
};

const searchActiveStyle = {
  borderColor: "rgba(255,106,0,.75)",
  background: "rgba(255,106,0,.10)",
  boxShadow: "0 0 0 3px rgba(255,106,0,.10)",
};

const searchInputStyle = {
  width: "100%",
  minWidth: 0,
  border: 0,
  outline: 0,
  background: "transparent",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
};

const clearSearchButtonStyle = {
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  border: 0,
  borderRadius: 6,
  background: "rgba(255,255,255,.08)",
  color: "#d0d5dd",
  cursor: "pointer",
  padding: 0,
};

const emptySearchStyle = {
  marginTop: 12,
  padding: "12px 10px",
  border: "1px dashed rgba(255,255,255,.18)",
  borderRadius: 8,
  color: "#98a2b3",
  fontSize: 13,
  fontWeight: 700,
  textAlign: "center",
};

const resultsSummaryStyle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "6px 8px 2px",
  color: "#fdb17b",
  fontSize: 12,
  fontWeight: 800,
};

const searchGroupStyle = {
  padding: "4px 0 7px",
  borderBottom: "1px solid rgba(255,255,255,.07)",
};

const searchGroupTitleStyle = {
  margin: "5px 8px 3px",
  color: "#b8c1d1",
};
