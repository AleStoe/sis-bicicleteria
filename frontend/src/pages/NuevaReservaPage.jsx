import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listarClientes } from "../services/clientesService";
import { listarCatalogoPOS } from "../services/catalogoService";
import { crearReserva } from "../services/reservasService";
import {
  listarTarjetaPlanes,
  simularReglasComerciales,
} from "../services/reglasComercialesService";
import { formatMoney } from "../utils/formatters";
import { useSession } from "../context/SessionContext";

const ID_SUCURSAL = 1;

const MEDIOS = ["efectivo", "transferencia", "mercadopago", "tarjeta"];

const SIMULACION_INICIAL = {
  loading: false,
  error: "",
  data: null,
};

export default function NuevaReservaPage() {
  const navigate = useNavigate();
  const { usuarioId } = useSession();

  const [clientes, setClientes] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [nota, setNota] = useState("");
  const [registrarSena, setRegistrarSena] = useState(false);
  const [planesTarjeta, setPlanesTarjeta] = useState([]);
  const [senaForm, setSenaForm] = useState({
    monto_base: "",
    medio_pago: "efectivo",
    id_tarjeta_plan: "",
    cuotas: "",
    entidad: "",
    nota: "",
  });

  const [simulacionSena, setSimulacionSena] = useState(SIMULACION_INICIAL);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => cargarCatalogo(), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const total = useMemo(() => {
    return items.reduce(
      (acc, item) =>
        acc + Number(item.precio_estimado || 0) * Number(item.cantidad || 0),
      0
    );
  }, [items]);

  const senaBase = registrarSena ? Number(senaForm.monto_base || 0) : 0;
  const tramoSena = simulacionSena.data?.tramos_pago?.[0] || null;
  const senaCobrado = tramoSena
    ? Number(tramoSena.monto_total_cobrado || 0)
    : senaBase;
  const senaDescuento = tramoSena ? Number(tramoSena.descuento_aplicado || 0) : 0;
  const senaRecargo = tramoSena ? Number(tramoSena.recargo_aplicado || 0) : 0;
  const saldoBase = Math.max(total - senaBase, 0);

  useEffect(() => {
    if (!registrarSena || senaBase <= 0) {
      setSimulacionSena(SIMULACION_INICIAL);
      return;
    }

    if (senaBase > total && total > 0) {
      setSimulacionSena({
        loading: false,
        error: "La base de seña supera el total estimado",
        data: null,
      });
      return;
    }

    if (senaForm.medio_pago === "tarjeta" && !senaForm.id_tarjeta_plan) {
      setSimulacionSena({
        loading: false,
        error: "Seleccioná un plan de tarjeta para simular la seña",
        data: null,
      });
      return;
    }

    const handle = setTimeout(() => {
      simularSena();
    }, 350);

    return () => clearTimeout(handle);
  }, [
    registrarSena,
    senaBase,
    total,
    senaForm.medio_pago,
    senaForm.cuotas,
    senaForm.entidad,
    senaForm.id_tarjeta_plan,
  ]);

  async function cargarInicial() {
    try {
      setLoading(true);
      setError("");

      const [clientesData, catalogoData, planesData] = await Promise.all([
        listarClientes({ solo_activos: true }),
        listarCatalogoPOS({ id_sucursal: ID_SUCURSAL, limit: 80 }),
        listarTarjetaPlanes(true),
      ]);

      setClientes(clientesData || []);
      setCatalogo(Array.isArray(catalogoData) ? catalogoData : catalogoData?.items || []);
      setPlanesTarjeta(planesData || []);

      const primerClienteNoGenerico = (clientesData || []).find(
        (c) => Number(c.id) !== 1
      );
      if (primerClienteNoGenerico) setClienteId(String(primerClienteNoGenerico.id));
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogo() {
    try {
      setBuscando(true);

      const data = await listarCatalogoPOS({
        id_sucursal: ID_SUCURSAL,
        query: query.trim() || undefined,
        limit: 80,
      });

      setCatalogo(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar catálogo");
    } finally {
      setBuscando(false);
    }
  }

  async function simularSena() {
    try {
      setSimulacionSena((prev) => ({ ...prev, loading: true, error: "" }));

      const data = await simularReglasComerciales({
        subtotal_base: senaBase,
        medios_pago: [
          {
            medio_pago: senaForm.medio_pago,
            monto_base: senaBase,
            cuotas:
              senaForm.medio_pago === "tarjeta"
                ? Number(senaForm.cuotas || 1)
                : null,
            entidad:
              senaForm.medio_pago === "tarjeta"
                ? senaForm.entidad || null
                : null,
            id_tarjeta_plan:
              senaForm.medio_pago === "tarjeta"
                ? Number(senaForm.id_tarjeta_plan)
                : null,
            nota: senaForm.nota || "Simulación de seña de reserva",
          },
        ],
      });

      setSimulacionSena({ loading: false, error: "", data });
    } catch (err) {
      setSimulacionSena({
        loading: false,
        error: err.message || "No se pudo simular la seña",
        data: null,
      });
    }
  }

  function descripcionProducto(item) {
    return [item.producto_nombre, item.nombre_variante].filter(Boolean).join(" - ");
  }

  function puedeAgregar(producto) {
    if (producto.disponible_para_venta === false) return false;
    if (producto.stockeable && Number(producto.stock_disponible || 0) <= 0) return false;
    if (Number(producto.precio_minorista || 0) <= 0) return false;
    return true;
  }

  function agregarItem(producto) {
    if (!puedeAgregar(producto)) {
      setError("El producto no está disponible para reservar");
      return;
    }

    setError("");

    setItems((actual) => {
      const existente = actual.find(
        (item) => Number(item.id_variante) === Number(producto.id_variante)
      );

      if (existente) {
        const cantidad = Number(existente.cantidad) + 1;

        if (producto.stockeable && cantidad > Number(producto.stock_disponible || 0)) {
          setError("La cantidad supera el stock disponible");
          return actual;
        }

        return actual.map((item) =>
          Number(item.id_variante) === Number(producto.id_variante)
            ? { ...item, cantidad }
            : item
        );
      }

      return [
        ...actual,
        {
          id_variante: producto.id_variante,
          descripcion: descripcionProducto(producto),
          codigo: producto.codigo_barras || producto.sku || `#${producto.id_variante}`,
          cantidad: 1,
          precio_estimado: Number(producto.precio_minorista || 0),
          stockeable: producto.stockeable,
          stock_disponible: Number(producto.stock_disponible || 0),
          id_bicicleta_serializada: null,
        },
      ];
    });
  }

  function cambiarCantidad(idVariante, value) {
    const cantidad = Number(value);

    if (!Number.isFinite(cantidad)) return;

    if (cantidad <= 0) {
      quitarItem(idVariante);
      return;
    }

    setItems((actual) =>
      actual.map((item) => {
        if (Number(item.id_variante) !== Number(idVariante)) return item;

        if (item.stockeable && cantidad > item.stock_disponible) {
          setError("La cantidad supera el stock disponible");
          return item;
        }

        return { ...item, cantidad };
      })
    );
  }

  function quitarItem(idVariante) {
    setItems((actual) =>
      actual.filter((item) => Number(item.id_variante) !== Number(idVariante))
    );
  }

  function seleccionarPlanTarjeta(planId) {
    const plan = planesTarjeta.find((p) => String(p.id) === String(planId));

    setSenaForm((prev) => ({
      ...prev,
      id_tarjeta_plan: planId,
      cuotas: plan?.cuotas || "",
      entidad: plan?.entidad || "",
    }));
  }

  async function handleCrearReserva(e) {
    e.preventDefault();

    if (!clienteId) {
      setError("Seleccioná un cliente");
      return;
    }

    if (items.length === 0) {
      setError("Agregá al menos un item");
      return;
    }

    if (registrarSena) {
      if (senaBase <= 0) {
        setError("La seña debe ser mayor a 0");
        return;
      }

      if (senaBase > total) {
        setError("La seña no puede superar el total estimado");
        return;
      }

      if (senaForm.medio_pago === "tarjeta" && !senaForm.id_tarjeta_plan) {
        setError("Seleccioná un plan de tarjeta para la seña");
        return;
      }

      if (simulacionSena.error) {
        setError(simulacionSena.error);
        return;
      }
    }

    const payload = {
      id_cliente: Number(clienteId),
      id_sucursal: ID_SUCURSAL,
      id_usuario: usuarioId,
      fecha_vencimiento: fechaVencimiento || null,
      nota: nota.trim() || null,
      items: items.map((item) => ({
        id_variante: Number(item.id_variante),
        id_bicicleta_serializada: item.id_bicicleta_serializada || null,
        cantidad: Number(item.cantidad),
        precio_estimado: Number(item.precio_estimado),
      })),
      pago_inicial: registrarSena
        ? {
            registrar: true,
            medio_pago: senaForm.medio_pago,
            monto_base: senaBase,
            monto: senaBase,
            id_tarjeta_plan:
              senaForm.medio_pago === "tarjeta"
                ? Number(senaForm.id_tarjeta_plan)
                : null,
            cuotas:
              senaForm.medio_pago === "tarjeta"
                ? Number(senaForm.cuotas || 1)
                : null,
            entidad:
              senaForm.medio_pago === "tarjeta" ? senaForm.entidad || null : null,
            nota: senaForm.nota.trim() || "Seña de reserva",
          }
        : {
            registrar: false,
            monto_base: null,
            monto: null,
            medio_pago: null,
            nota: null,
          },
    };

    try {
      setGuardando(true);
      setError("");

      const res = await crearReserva(payload);
      navigate(`/reservas/${res.reserva_id}`);
    } catch (err) {
      setError(err.message || "No se pudo crear la reserva");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p style={{ padding: "24px" }}>Cargando nueva reserva...</p>;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Nueva reserva</h1>
          <p style={mutedStyle}>
            Reserva stock, registra seña opcional y controla saldo estimado.
          </p>
        </div>

        <Link to="/reservas" style={linkBtnStyle}>
          Volver
        </Link>
      </div>

      {error && <div style={alertStyle}>Error: {error}</div>}

      <form onSubmit={handleCrearReserva} style={layoutStyle}>
        <section style={cardStyle}>
          <div style={formGridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Cliente</span>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre} #{cliente.id}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Vencimiento</span>
              <input
                type="datetime-local"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Nota</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              style={textareaStyle}
            />
          </label>

          <h2 style={cardTitleStyle}>Agregar productos</h2>
          <div style={searchRowStyle}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto, SKU o código"
              style={inputStyle}
            />
            <button type="button" onClick={cargarCatalogo}>
              {buscando ? "..." : "Buscar"}
            </button>
          </div>

          <div style={catalogListStyle}>
            {(Array.isArray(catalogo) ? catalogo : []).map((producto) => (
              <button
                type="button"
                key={producto.id_variante}
                onClick={() => agregarItem(producto)}
                disabled={!puedeAgregar(producto)}
                style={!puedeAgregar(producto) ? productBlockedStyle : productRowStyle}
              >
                <div>
                  <strong>{descripcionProducto(producto)}</strong>
                  <div style={mutedStyle}>
                    {producto.codigo_barras || producto.sku || `#${producto.id_variante}`}
                  </div>
                  <div style={mutedStyle}>
                    {producto.stockeable
                      ? `Stock disponible: ${producto.stock_disponible}`
                      : "Servicio"}
                  </div>
                </div>
                <strong>{formatMoney(producto.precio_minorista)}</strong>
              </button>
            ))}
          </div>
        </section>

        <aside style={cardStyle}>
          <h2 style={cardTitleStyle}>Items reservados</h2>

          {items.length === 0 ? (
            <div style={emptyStyle}>No hay items agregados.</div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {items.map((item) => (
                <div key={item.id_variante} style={cartItemStyle}>
                  <div>
                    <strong>{item.descripcion}</strong>
                    <div style={mutedStyle}>{item.codigo}</div>
                  </div>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.cantidad}
                    onChange={(e) => cambiarCantidad(item.id_variante, e.target.value)}
                    style={qtyStyle}
                  />

                  <strong>
                    {formatMoney(Number(item.precio_estimado) * Number(item.cantidad))}
                  </strong>

                  <button type="button" onClick={() => quitarItem(item.id_variante)}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}

          <section style={summaryStyle}>
            <Line label="Total estimado" value={formatMoney(total)} />
            <Line label="Base cubierta por seña" value={formatMoney(senaBase)} />
            <div style={totalLineStyle}>
              <strong>Saldo base</strong>
              <strong>{formatMoney(saldoBase)}</strong>
            </div>
          </section>

          <section style={senaStyle}>
            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={registrarSena}
                onChange={(e) => setRegistrarSena(e.target.checked)}
              />
              Registrar seña ahora
            </label>

            {registrarSena && (
              <div style={{ display: "grid", gap: "10px" }}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Base a cubrir</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={senaForm.monto_base}
                    onChange={(e) =>
                      setSenaForm((p) => ({ ...p, monto_base: e.target.value }))
                    }
                    style={inputStyle}
                  />
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>Medio</span>
                  <select
                    value={senaForm.medio_pago}
                    onChange={(e) =>
                      setSenaForm((p) => ({
                        ...p,
                        medio_pago: e.target.value,
                        id_tarjeta_plan: "",
                        cuotas: "",
                        entidad: "",
                      }))
                    }
                    style={inputStyle}
                  >
                    {MEDIOS.map((medio) => (
                      <option key={medio} value={medio}>
                        {medio}
                      </option>
                    ))}
                  </select>
                </label>

                {senaForm.medio_pago === "tarjeta" && (
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Plan de tarjeta</span>
                    <select
                      value={senaForm.id_tarjeta_plan}
                      onChange={(e) => seleccionarPlanTarjeta(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar plan</option>
                      {planesTarjeta.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.entidad ? `${plan.entidad} · ` : ""}
                          {plan.cuotas} cuota(s) · {Number(plan.porcentaje_recargo_cliente || 0).toFixed(2)}%
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <SimulacionSenaBox
                  simulacion={simulacionSena}
                  base={senaBase}
                  descuento={senaDescuento}
                  recargo={senaRecargo}
                  cobrado={senaCobrado}
                  saldoBase={saldoBase}
                  medioPago={senaForm.medio_pago}
                />

                <label style={fieldStyle}>
                  <span style={labelStyle}>Nota de pago</span>
                  <input
                    value={senaForm.nota}
                    onChange={(e) => setSenaForm((p) => ({ ...p, nota: e.target.value }))}
                    style={inputStyle}
                  />
                </label>

                <div style={noteStyle}>
                  Registrar seña exige caja abierta. El total a cobrar sale del motor financiero.
                </div>
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={guardando || items.length === 0 || simulacionSena.loading}
            style={primaryBtnStyle}
          >
            {guardando ? "Creando..." : "Crear reserva"}
          </button>
        </aside>
      </form>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div style={lineStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimulacionSenaBox({
  simulacion,
  base,
  descuento,
  recargo,
  cobrado,
  saldoBase,
  medioPago,
}) {
  if (base <= 0) {
    return (
      <div style={previewEmptyStyle}>
        Ingresá una base de seña para ver cuánto debe cobrar el operador.
      </div>
    );
  }

  if (simulacion.loading) {
    return <div style={previewEmptyStyle}>Simulando seña...</div>;
  }

  if (simulacion.error) {
    return <div style={previewErrorStyle}>{simulacion.error}</div>;
  }

  return (
    <div style={previewStyle}>
      <div style={previewHeaderStyle}>Simulación de seña</div>
      <Line label="Base cubierta" value={formatMoney(base)} />
      {descuento > 0 && <Line label="Descuento aplicado" value={`-${formatMoney(descuento)}`} />}
      {recargo > 0 && <Line label="Recargo aplicado" value={formatMoney(recargo)} />}
      <div style={previewTotalStyle}>
        <span>Total a cobrar</span>
        <strong>{formatMoney(cobrado)}</strong>
      </div>
      <Line label="Saldo base restante" value={formatMoney(saldoBase)} />
      {medioPago === "tarjeta" && (
        <div style={previewHintStyle}>
          La reserva cubre la base. El recargo es costo financiero del medio de pago.
        </div>
      )}
    </div>
  );
}

const pageStyle = { padding: "24px", background: "#f6f7fb", minHeight: "100vh" };
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "16px",
  flexWrap: "wrap",
};
const mutedStyle = { color: "#667085", fontSize: "13px", margin: "4px 0 0" };
const linkBtnStyle = {
  textDecoration: "none",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  color: "#111827",
  background: "white",
};
const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "16px",
};
const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(520px, 1fr) minmax(360px, 460px)",
  gap: "16px",
  alignItems: "start",
};
const cardStyle = {
  background: "white",
  borderRadius: "14px",
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding: "16px",
  marginBottom: "16px",
};
const formGridStyle = { display: "grid", gridTemplateColumns: "1fr 220px", gap: "12px" };
const fieldStyle = { display: "flex", flexDirection: "column", gap: "7px", marginBottom: "10px" };
const labelStyle = { fontWeight: "bold", fontSize: "14px" };
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  fontSize: "15px",
  boxSizing: "border-box",
};
const textareaStyle = { ...inputStyle, minHeight: "68px", resize: "vertical" };
const cardTitleStyle = { marginTop: 0, marginBottom: "14px", fontSize: "20px" };
const searchRowStyle = { display: "flex", gap: "8px", marginBottom: "10px" };
const catalogListStyle = { display: "grid", gap: "8px", maxHeight: "430px", overflowY: "auto" };
const productRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  border: "1px solid #eaecf0",
  background: "white",
  borderRadius: "12px",
  padding: "12px",
  textAlign: "left",
  cursor: "pointer",
};
const productBlockedStyle = {
  ...productRowStyle,
  opacity: 0.55,
  cursor: "not-allowed",
  background: "#f9fafb",
};
const emptyStyle = {
  color: "#667085",
  background: "#f9fafb",
  borderRadius: "10px",
  padding: "16px",
  textAlign: "center",
};
const cartItemStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 70px 100px 34px",
  gap: "8px",
  alignItems: "center",
  borderBottom: "1px solid #f2f4f7",
  paddingBottom: "8px",
};
const qtyStyle = {
  width: "70px",
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #d0d5dd",
};
const summaryStyle = { borderTop: "1px solid #eaecf0", paddingTop: "12px", marginTop: "14px" };
const lineStyle = { display: "flex", justifyContent: "space-between", padding: "7px 0", gap: "12px" };
const totalLineStyle = {
  display: "flex",
  justifyContent: "space-between",
  paddingTop: "10px",
  fontSize: "22px",
  color: "#0b5bd3",
};
const senaStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "12px",
  margin: "12px 0",
};
const checkStyle = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" };
const noteStyle = {
  background: "#f9fafb",
  borderLeft: "4px solid #111827",
  padding: "10px",
  borderRadius: "8px",
  color: "#344054",
};
const previewStyle = {
  border: "1px solid #b2ddff",
  background: "#eff8ff",
  borderRadius: "12px",
  padding: "12px",
};
const previewHeaderStyle = { fontWeight: 900, marginBottom: "6px", color: "#175cd3" };
const previewTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  borderTop: "1px solid #b2ddff",
  borderBottom: "1px solid #b2ddff",
  padding: "10px 0",
  margin: "6px 0",
  fontSize: "18px",
  color: "#0b5bd3",
};
const previewHintStyle = {
  marginTop: "8px",
  fontSize: "12px",
  color: "#475467",
};
const previewEmptyStyle = {
  background: "#f9fafb",
  border: "1px dashed #d0d5dd",
  borderRadius: "10px",
  padding: "10px",
  color: "#667085",
};
const previewErrorStyle = {
  background: "#fff1f0",
  border: "1px solid #f4c7c3",
  borderRadius: "10px",
  padding: "10px",
  color: "#b42318",
};
const primaryBtnStyle = {
  width: "100%",
  border: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "12px",
  padding: "14px",
  fontWeight: 900,
  fontSize: "16px",
};
