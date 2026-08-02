import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, Wrench } from "lucide-react";
import {
  corregirCapitalSinCaja,
  obtenerCorreccionesPendientes,
  validarCapitalFueraCaja,
} from "../services/correccionesService";
import { useSession } from "../context/SessionContext";
import { formatMoney } from "../utils/formatters";

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 28px rgba(15,23,42,.06)",
};

const primaryButton = {
  border: "none",
  borderRadius: 12,
  padding: "10px 13px",
  background: "#f97316",
  color: "white",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryButton = {
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  padding: "10px 13px",
  background: "#fff",
  color: "#101828",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
};

export default function CorreccionesPage() {
  const { usuarioId } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [corrigiendoId, setCorrigiendoId] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setData(await obtenerCorreccionesPendientes());
    } catch (err) {
      setError(err.message || "No se pudieron cargar las correcciones");
    } finally {
      setLoading(false);
    }
  }

  const total = useMemo(() => {
    if (!data) return 0;
    return Object.values(data).reduce((acc, items) => acc + (Array.isArray(items) ? items.length : 0), 0);
  }, [data]);

  async function registrarEgresoCapital(item) {
    const motivo = window.prompt(
      `Este movimiento de ${formatMoney(item.monto)} no impacto caja.\n\nMotivo de la correccion:`,
      "Movimiento cargado sin impacto en caja por error operativo",
    );
    if (!motivo) return;

    const confirmar = window.confirm(
      `Se registrara un egreso en la caja abierta por ${formatMoney(item.monto)} y quedara vinculado al movimiento de Capital/Retiros #${item.id}.\n\nConfirmas la correccion?`,
    );
    if (!confirmar) return;

    setCorrigiendoId(item.id);
    setError("");
    setOk("");
    try {
      const resultado = await corregirCapitalSinCaja(item.id, {
        motivo,
        id_usuario: usuarioId,
      });
      setOk(`Correccion aplicada. Movimiento de caja #${resultado.caja_movimiento_id}.`);
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo aplicar la correccion");
    } finally {
      setCorrigiendoId(null);
    }
  }

  async function validarFueraDeCaja(item) {
    const motivo = window.prompt(
      `Este movimiento de ${formatMoney(item.monto)} quedara validado como salida fuera de caja.\n\nMotivo:`,
      "Retiro pagado desde fondos guardados fuera de caja",
    );
    if (!motivo) return;

    const confirmar = window.confirm(
      `No se movera dinero de caja.\n\nEl movimiento Capital/Retiros #${item.id} dejara de aparecer como pendiente en Correcciones y quedara auditado.\n\nConfirmas la validacion?`,
    );
    if (!confirmar) return;

    setCorrigiendoId(item.id);
    setError("");
    setOk("");
    try {
      await validarCapitalFueraCaja(item.id, {
        motivo,
        id_usuario: usuarioId,
      });
      setOk("Movimiento validado como salida fuera de caja.");
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo validar el movimiento");
    } finally {
      setCorrigiendoId(null);
    }
  }

  return (
    <main style={{ display: "grid", gap: 18, padding: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "#f97316", fontSize: 12, fontWeight: 950, textTransform: "uppercase" }}>
            Control seguro
          </p>
          <h1 style={{ margin: "4px 0 0", color: "#101828" }}>Centro de correcciones</h1>
          <p style={{ margin: "6px 0 0", color: "#667085", lineHeight: 1.45 }}>
            Detecta operaciones torcidas y corrige solo caminos seguros con auditoria.
          </p>
        </div>
        <button type="button" style={secondaryButton} onClick={cargar}>
          {loading ? "Revisando..." : "Revisar ahora"}
        </button>
      </header>

      {error && <div style={{ ...card, padding: 14, borderColor: "#fecaca", color: "#b91c1c", background: "#fef2f2" }}>{error}</div>}
      {ok && <div style={{ ...card, padding: 14, borderColor: "#bbf7d0", color: "#166534", background: "#f0fdf4" }}>{ok}</div>}

      <section style={{ ...card, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <strong style={{ fontSize: 20 }}>{total ? `${total} pendiente${total === 1 ? "" : "s"} para revisar` : "Sin correcciones pendientes"}</strong>
          <p style={{ margin: "4px 0 0", color: "#667085" }}>
            Las correcciones automaticas quedan limitadas a caminos seguros. Los casos que dependen de una decision comercial se resuelven desde su modulo.
          </p>
        </div>
        {total ? <AlertTriangle color="#f97316" /> : <CheckCircle2 color="#16a34a" />}
      </section>

      <CorreccionSection
        title="Costos y margenes sospechosos"
        description="Ventas con costo aplicado raro, margen demasiado bajo o diferencia fuerte contra el costo vigente."
        guide={[
          "Abrir la venta y confirmar si el costo aplicado corresponde al producto vendido.",
          "Abrir el producto si el costo vigente tambien esta mal cargado.",
          "Si el error es historico, corregir con auditoria. No tocar caja ni stock.",
          "Esta lista no corrige sola: solo marca operaciones que pueden ensuciar rentabilidad.",
        ]}
        items={data?.costos_sospechosos || []}
        renderItem={(item) => (
          <CorreccionItem
            key={item.id}
            title={`Venta #${item.id_venta} - Item #${item.id}`}
            subtitle={`${item.cliente_nombre} - ${motivoCostoLabel(item.motivo_alerta)}`}
            amount={formatMoney(item.margen_item)}
            detail={`${item.descripcion_snapshot} - Vendido ${formatMoney(item.subtotal)} - CMV ${formatMoney(item.cmv_item)} - Margen ${formatPercent(item.margen_porcentaje_sobre_venta)}`}
            action={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {item.id_producto && (
                  <Link to={`/catalogo/productos/${item.id_producto}`} style={secondaryButton}>
                    Ver producto <ExternalLink size={14} />
                  </Link>
                )}
                <Link to={`/ventas/${item.id_venta}`} style={secondaryButton}>
                  Ver venta <ExternalLink size={14} />
                </Link>
              </div>
            }
          />
        )}
      />

      <CorreccionSection
        title="Capital/Retiros sin caja"
        description="Salidas de dinero registradas en Capital y Retiros que no generaron movimiento de caja."
        guide={[
          "Si realmente salio de caja, registrar el egreso vinculado con una caja abierta.",
          "Si se pago con fondos guardados fuera de caja, validarlo sin mover caja.",
          "Ambos caminos conservan auditoria; no mezcles fondos en un solo movimiento.",
        ]}
        items={data?.capital_sin_caja || []}
        renderItem={(item) => (
          <CorreccionItem
            key={item.id}
            title={`Movimiento #${item.id} - ${tipoCapitalLabel(item.tipo_movimiento)}`}
            subtitle={`${item.participante_nombre} - ${item.fecha} - ${item.medio_pago || "sin medio"}`}
            amount={formatMoney(item.monto)}
            detail={item.descripcion}
            action={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={secondaryButton}
                  disabled={corrigiendoId === item.id}
                  onClick={() => validarFueraDeCaja(item)}
                >
                  Validar fuera de caja
                </button>
                <button
                  type="button"
                  style={primaryButton}
                  disabled={corrigiendoId === item.id}
                  onClick={() => registrarEgresoCapital(item)}
                >
                  {corrigiendoId === item.id ? "Procesando..." : "Registrar egreso vinculado"}
                </button>
              </div>
            }
          />
        )}
      />

      <CorreccionSection
        title="Ventas con saldo sin deuda formal"
        description="Ventas entregadas que conservan saldo pendiente, pero no tienen deuda formal asociada."
        guide={[
          "Abrir la venta y revisar si corresponde cobrar el saldo pendiente.",
          "Si el cliente retiro con deuda autorizada, generar o regularizar la deuda formal.",
          "Si la venta fue un error operativo, anular o devolver desde el flujo de venta.",
          "No se corrige automatico porque el sistema no puede decidir si falta cobrar, documentar deuda o anular.",
        ]}
        items={data?.ventas_saldo_sin_deuda || []}
        renderItem={(item) => (
          <CorreccionItem
            key={item.id}
            title={`Venta #${item.id} - ${item.estado}`}
            subtitle={item.cliente_nombre}
            amount={formatMoney(item.saldo_pendiente)}
            detail={`Total ${formatMoney(item.total_final)} - saldo pendiente sin deuda formal`}
            action={<Link to={`/ventas/${item.id}`} style={secondaryButton}>Resolver en venta <ExternalLink size={14} /></Link>}
          />
        )}
      />

      <CorreccionSection
        title="Creditos de anulacion para revisar"
        description="Creditos abiertos de ventas que tuvieron tarjeta o MercadoPago."
        guide={[
          "Revisar si el dinero quedo a favor del cliente dentro del negocio.",
          "Si fue tarjeta, QR o MercadoPago, confirmar si el pago ya se revirtio en la terminal o plataforma.",
          "Usar el credito solo si corresponde credito comercial real.",
          "No se corrige automatico para no devolver plata dos veces.",
        ]}
        items={data?.creditos_anulacion_dudosos || []}
        renderItem={(item) => (
          <CorreccionItem
            key={item.id}
            title={`Credito #${item.id} - Venta #${item.origen_id}`}
            subtitle={`${item.cliente_nombre} - ${item.medio_electronico}`}
            amount={formatMoney(item.saldo_actual)}
            detail={item.observacion || "Credito comercial pendiente de revision"}
            action={<Link to={`/creditos/${item.id}`} style={secondaryButton}>Revisar credito <ExternalLink size={14} /></Link>}
          />
        )}
      />

      <CorreccionSection
        title="Cajas abiertas anteriores"
        description="Cajas que quedaron abiertas de dias anteriores."
        guide={[
          "Entrar a Caja y revisar movimientos del dia de apertura.",
          "Hacer el arqueo real antes de cerrar.",
          "No se cierran desde Correcciones porque el cierre requiere conteo y validacion del efectivo real.",
        ]}
        items={data?.cajas_abiertas_anteriores || []}
        renderItem={(item) => (
          <CorreccionItem
            key={item.id}
            title={`Caja #${item.id} - ${item.sucursal_nombre}`}
            subtitle={item.fecha}
            amount={formatMoney(item.monto_apertura)}
            detail="Caja abierta de un dia anterior"
            action={<Link to="/caja" style={secondaryButton}>Ir a caja <ExternalLink size={14} /></Link>}
          />
        )}
      />
    </main>
  );
}

function CorreccionSection({ title, description, guide = [], items, renderItem }) {
  return (
    <section style={{ ...card, overflow: "hidden" }}>
      <div style={{ padding: 16, borderBottom: "1px solid #eaecf0", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#101828" }}>{title}</h2>
          <p style={{ margin: "4px 0 0", color: "#667085", lineHeight: 1.45 }}>{description}</p>
          {guide.length > 0 && (
            <div style={guideBoxStyle}>
              <strong>Como resolverlo</strong>
              <ul style={guideListStyle}>
                {guide.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <span style={{ ...pillStyle, background: items.length ? "#fff7ed" : "#ecfdf3", color: items.length ? "#c2410c" : "#067647" }}>
          {items.length}
        </span>
      </div>
      <div style={{ display: "grid" }}>
        {items.length ? items.map(renderItem) : <div style={{ padding: 16, color: "#667085", fontWeight: 800 }}>Sin pendientes.</div>}
      </div>
    </section>
  );
}

function CorreccionItem({ title, subtitle, amount, detail, action }) {
  return (
    <div style={{ padding: 14, borderBottom: "1px solid #f2f4f7", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Wrench size={16} color="#f97316" />
          <strong style={{ color: "#101828" }}>{title}</strong>
          <span style={pillStyle}>{amount}</span>
        </div>
        <div style={{ marginTop: 4, color: "#475467", fontSize: 13 }}>{subtitle}</div>
        <div style={{ marginTop: 4, color: "#667085", fontSize: 13 }}>{detail}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>{action}</div>
    </div>
  );
}

function tipoCapitalLabel(tipo) {
  const labels = {
    devolucion_prestamo: "Devolucion de prestamo",
    retiro_personal: "Retiro personal",
    distribucion_ganancia: "Distribucion de ganancia",
  };
  return labels[tipo] || tipo;
}

function motivoCostoLabel(motivo) {
  const labels = {
    margen_negativo: "margen negativo",
    producto_sin_costo: "producto sin costo",
    margen_muy_bajo: "margen muy bajo",
    costo_distinto_al_vigente: "costo distinto al vigente",
  };
  return labels[motivo] || motivo;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return `${number.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

const guideBoxStyle = {
  marginTop: 10,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#9a3412",
  maxWidth: 900,
};

const guideListStyle = {
  margin: "6px 0 0",
  paddingLeft: 18,
  color: "#7c2d12",
  lineHeight: 1.45,
  fontSize: 13,
  fontWeight: 750,
};

const pillStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "5px 10px",
  background: "#f8fafc",
  color: "#344054",
  fontSize: 12,
  fontWeight: 900,
};
