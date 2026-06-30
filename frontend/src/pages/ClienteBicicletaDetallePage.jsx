import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  obtenerHistorialBicicletaCliente,
  actualizarBicicletaCliente,
  autorizarServiceVencido,
  crearServicePostventa,
} from "../services/clientesService";
import { formatMoney } from "../utils/formatters";
import { formatDate } from "../utils/formatters";
export default function ClienteBicicletaDetallePage() {
  const { clienteId, bicicletaId } = useParams();
  const navigate = useNavigate();
  const { usuarioId, sucursalId } = useSession();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({
    marca: "",
    modelo: "",
    rodado: "",
    color: "",
    numero_cuadro: "",
    notas: "",
  });

  useEffect(() => {
    cargarHistorial();
  }, [clienteId, bicicletaId]);

  async function cargarHistorial() {
    try {
      setLoading(true);
      setError("");

      const detalle = await obtenerHistorialBicicletaCliente(clienteId, bicicletaId);
      setData(detalle);
    } catch (err) {
      setError(err.message || "No se pudo cargar el historial de la bicicleta");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutorizarServiceVencido() {
    const motivo = window.prompt(
      "Motivo de autorización fuera de plazo:",
      "Cliente informa que no usó la bicicleta y se autoriza excepción comercial."
    );

    if (!motivo || !motivo.trim()) return;

    try {
      setActionLoading(true);
      setError("");

      await autorizarServiceVencido(clienteId, bicicletaId, {
        id_usuario: usuarioId,
        motivo: motivo.trim(),
      });

      await cargarHistorial();
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo autorizar el service vencido");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCrearServicePostventa() {
    if (!window.confirm("¿Crear orden de taller para el service bonificado de 30 días?")) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const resultado = await crearServicePostventa(clienteId, bicicletaId, {
        id_sucursal: sucursalId || 1,
        id_usuario: usuarioId,
      });

      navigate(`/taller/${resultado.orden_id}`);
    } catch (err) {
      const mensaje =
        err?.detail ||
        err?.message ||
        "No se pudo crear el service postventa";

      if (
        mensaje.includes(
          "Ya existe una orden de service postventa pendiente"
        )
      ) {
        const match = mensaje.match(/#(\d+)/);
        const ordenId = match?.[1];

        setError(
          ordenId
            ? `Ya existe un service postventa pendiente para esta bicicleta (OT #${ordenId}). Revisá o cerrá esa orden antes de crear otra.`
            : "Ya existe un service postventa pendiente para esta bicicleta."
        );
      } else {
        setError(mensaje);
      }
    } finally {
      setActionLoading(false);
    }
  }

  function abrirEdicionBicicleta() {
    const bicicleta = data?.bicicleta;
    if (!bicicleta) return;

    setEditForm({
      marca: bicicleta.marca || "",
      modelo: bicicleta.modelo || "",
      rodado: bicicleta.rodado || "",
      color: bicicleta.color || "",
      numero_cuadro: bicicleta.numero_cuadro || "",
      notas: bicicleta.notas || "",
    });
    setEditando(true);
    setError("");
  }

  function actualizarCampoBicicleta(campo, valor) {
    const camposUpper = new Set(["marca", "modelo", "color", "numero_cuadro"]);
    setEditForm((actual) => ({
      ...actual,
      [campo]: camposUpper.has(campo) ? valor.toUpperCase() : valor,
    }));
  }

  async function guardarEdicionBicicleta(e) {
    e.preventDefault();

    try {
      setActionLoading(true);
      setError("");

      await actualizarBicicletaCliente(clienteId, bicicletaId, {
        ...editForm,
        id_usuario: usuarioId || null,
        id_sucursal: sucursalId || null,
      });

      setEditando(false);
      await cargarHistorial();
    } catch (err) {
      setError(err?.detail || err?.message || "No se pudo actualizar la bicicleta");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <p style={{ padding: "24px" }}>Cargando historial de bicicleta...</p>;
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={alertStyle}>Error: {error}</div>
        <button style={secondaryBtnStyle} onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    );
  }

  const bicicleta = data?.bicicleta;
  const ventaOrigen = data?.venta_origen;
  const historialTaller = data?.historial_taller || [];
  const timeline = data?.timeline || [];
  const notasTecnicas = data?.notas_tecnicas || [];
  const estadoPostventa = calcularEstadoPostventa(bicicleta);
  const ultimoEvento = getUltimoEventoBicicleta(timeline, historialTaller, ventaOrigen);

  if (!bicicleta) {
    return <p style={{ padding: "24px" }}>No se encontró la bicicleta.</p>;
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>
            {bicicleta.marca} {bicicleta.modelo}
          </h1>
          <p style={subtitleStyle}>
            Bicicleta #{bicicleta.id} · Cliente #{bicicleta.id_cliente}
          </p>
        </div>

        <div style={actionsStyle}>
          <button type="button" onClick={cargarHistorial} style={secondaryBtnStyle}>
            Refrescar
          </button>

          <button type="button" onClick={abrirEdicionBicicleta} style={secondaryBtnStyle}>
            Editar bicicleta
          </button>

          <Link to={`/clientes/${clienteId}`} style={secondaryLinkStyle}>
            Volver al cliente
          </Link>

          <Link
            to={`/taller/nueva?cliente_id=${clienteId}&bicicleta_id=${bicicletaId}`}
            style={primaryLinkStyle}
          >
            Nueva orden taller
          </Link>
        </div>
      </header>

      <BicicletaLecturaRapida
        bicicleta={bicicleta}
        ventaOrigen={ventaOrigen}
        historialTaller={historialTaller}
        timeline={timeline}
        estadoPostventa={estadoPostventa}
        ultimoEvento={ultimoEvento}
      />

      {editando && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={cardTitleStyle}>Editar bicicleta</h2>
              <span style={mutedStyle}>
                Cambia solo los datos descriptivos. Historial y postventa no se alteran.
              </span>
            </div>
          </div>

          <form onSubmit={guardarEdicionBicicleta} style={editFormStyle}>
            <label style={fieldStyle}>
              <span>Marca *</span>
              <input
                value={editForm.marca}
                onChange={(e) => actualizarCampoBicicleta("marca", e.target.value)}
                style={inputStyle}
                required
              />
            </label>

            <label style={fieldStyle}>
              <span>Modelo</span>
              <input
                value={editForm.modelo}
                onChange={(e) => actualizarCampoBicicleta("modelo", e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span>Rodado</span>
              <input
                value={editForm.rodado}
                onChange={(e) => actualizarCampoBicicleta("rodado", e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span>Color</span>
              <input
                value={editForm.color}
                onChange={(e) => actualizarCampoBicicleta("color", e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span>Numero de cuadro</span>
              <input
                value={editForm.numero_cuadro}
                onChange={(e) => actualizarCampoBicicleta("numero_cuadro", e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <span>Notas</span>
              <textarea
                value={editForm.notas}
                onChange={(e) => actualizarCampoBicicleta("notas", e.target.value)}
                style={textareaStyle}
                rows={3}
              />
            </label>

            <div style={editActionsStyle}>
              <button
                type="button"
                onClick={() => setEditando(false)}
                style={secondaryBtnStyle}
                disabled={actionLoading}
              >
                Cancelar
              </button>

              <button type="submit" style={primaryBtnStyle} disabled={actionLoading}>
                {actionLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Ficha de bicicleta</h2>

          <div style={infoGridStyle}>
            <Info label="Marca" value={bicicleta.marca || "-"} />
            <Info label="Modelo" value={bicicleta.modelo || "-"} />
            <Info label="Rodado" value={bicicleta.rodado || "-"} />
            <Info label="Color" value={bicicleta.color || "-"} />
            <Info label="Número de cuadro" value={bicicleta.numero_cuadro || "-"} />
            <Info
              label="Serializada"
              value={bicicleta.id_bicicleta_serializada ? `#${bicicleta.id_bicicleta_serializada}` : "-"}
            />
            <Info label="Notas" value={bicicleta.notas || "-"} full />
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Origen</h2>

          {ventaOrigen ? (
            <div style={originBoxStyle}>
              <div>
                <strong>Venta #{ventaOrigen.id}</strong>
                <div style={mutedStyle}>{formatDate(ventaOrigen.fecha)}</div>
              </div>

              <div style={originMetaStyle}>
                <span style={badgeEstado(ventaOrigen.estado)}>{ventaOrigen.estado}</span>
                <strong>{formatMoney(ventaOrigen.total_final)}</strong>
                <span style={mutedStyle}>
                  Saldo: {formatMoney(ventaOrigen.saldo_pendiente)}
                </span>
              </div>

              <Link to={`/ventas/${ventaOrigen.id}`} style={detailLinkStyle}>
                Ver venta origen
              </Link>
            </div>
          ) : (
            <div style={emptyStyle}>
              No hay venta origen vinculada. Puede ser una bicicleta cargada manualmente.
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <h2 style={cardTitleStyle}>Postventa</h2>

          <div style={infoGridStyle}>
            <Info label="Fecha de compra" value={formatNullableDate(bicicleta.fecha_compra)} />
            <Info label="Entrega" value={labelCondicionEntrega(bicicleta.condicion_entrega)} />
            <Info label="Plan postventa" value={labelPlanPostventa(bicicleta.plan_postventa)} />
            <div style={infoCardStyle}>
              <div style={infoLabelStyle}>Estado</div>
              <BadgePostventa estado={estadoPostventa} />
            </div>
            <Info
              label="Vence service bonificado"
              value={formatNullableDate(bicicleta.fecha_limite_service_gratis)}
            />
            <Info
              label="Orden service usado"
              value={
                bicicleta.id_orden_service_gratis ? (
                  <Link to={`/taller/${bicicleta.id_orden_service_gratis}`} style={detailLinkStyle}>
                    #{bicicleta.id_orden_service_gratis}
                  </Link>
                ) : "-"
              }
            />
            {bicicleta.service_gratis_autorizado_fuera_plazo && (
              <Info
                label="Autorización fuera de plazo"
                value={bicicleta.motivo_service_gratis_fuera_plazo || "Autorizado"}
                full
              />
            )}
          </div>

          <PostventaActions
            bicicleta={bicicleta}
            estadoPostventa={estadoPostventa}
            actionLoading={actionLoading}
            onAutorizar={handleAutorizarServiceVencido}
            onCrearService={handleCrearServicePostventa}
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Recomendaciones y alertas técnicas</h2>
            <span style={mutedStyle}>
              Información que conviene revisar en próximos ingresos al taller.
            </span>
          </div>
        </div>

        {notasTecnicas.length === 0 ? (
          <div style={emptyStyle}>No hay recomendaciones ni alertas activas.</div>
        ) : (
          <div style={technicalNotesGridStyle}>
            {notasTecnicas.map((nota) => (
              <article
                key={nota.id}
                style={
                  nota.tipo === "alerta_tecnica"
                    ? technicalAlertStyle
                    : technicalRecommendationStyle
                }
              >
                <div style={timelineHeaderStyle}>
                  <strong>
                    {nota.tipo === "alerta_tecnica"
                      ? "Alerta técnica"
                      : "Recomendación futura"}
                  </strong>
                  <span style={badgeEstado(nota.estado)}>{nota.estado}</span>
                </div>
                <p style={technicalNoteTextStyle}>{nota.contenido}</p>
                <div style={mutedStyle}>
                  OT #{nota.id_orden_taller} · {formatDate(nota.created_at)}
                  {nota.usuario_nombre ? ` · ${nota.usuario_nombre}` : ""}
                </div>
                <Link to={`/taller/${nota.id_orden_taller}`} style={detailLinkStyle}>
                  Ver orden
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Línea de tiempo</h2>
            <span style={mutedStyle}>
              Venta, service, reparaciones y repuestos asociados.
            </span>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div style={emptyStyle}>Todavía no hay eventos para esta bicicleta.</div>
        ) : (
          <div style={timelineStyle}>
            {timeline.map((evento, index) => (
              <div key={`${evento.tipo}-${evento.referencia_id || index}-${index}`} style={timelineItemStyle}>
                <div style={timelineDotStyle} />
                <div style={timelineCardStyle}>
                  <div style={timelineHeaderStyle}>
                    <div>
                      <strong>{evento.titulo}</strong>
                      <div style={mutedStyle}>{formatDate(evento.fecha)}</div>
                    </div>
                    <span style={badgeEstado(evento.tipo)}>{evento.tipo}</span>
                  </div>
                  {evento.descripcion && <div style={problemStyle}>{evento.descripcion}</div>}
                  {(evento.importe != null || evento.saldo != null) && (
                    <div style={moneyRowStyle}>
                      {evento.importe != null && <span>Importe: <strong>{formatMoney(evento.importe)}</strong></span>}
                      {evento.saldo != null && <span>Saldo: <strong>{formatMoney(evento.saldo)}</strong></span>}
                    </div>
                  )}
                  {evento.referencia_tipo === "orden_taller" && (
                    <Link to={`/taller/${evento.referencia_id}`} style={detailLinkStyle}>Ver orden</Link>
                  )}
                  {evento.referencia_tipo === "venta" && (
                    <Link to={`/ventas/${evento.referencia_id}`} style={detailLinkStyle}>Ver venta</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={cardTitleStyle}>Historial de taller</h2>
            <span style={mutedStyle}>
              Reparaciones y órdenes asociadas a esta bicicleta.
            </span>
          </div>
        </div>

        {historialTaller.length === 0 ? (
          <div style={emptyStyle}>Todavía no hay órdenes de taller asociadas.</div>
        ) : (
          <div style={timelineStyle}>
            {historialTaller.map((orden) => (
              <div key={orden.id} style={timelineItemStyle}>
                <div style={timelineDotStyle} />

                <div style={timelineCardStyle}>
                  <div style={timelineHeaderStyle}>
                    <div>
                      <strong>Orden #{orden.id}</strong>
                      <div style={mutedStyle}>{formatDate(orden.fecha_ingreso)}</div>
                    </div>

                    <span style={badgeEstado(orden.estado)}>{orden.estado}</span>
                  </div>

                  <div style={problemStyle}>
                    {orden.problema_reportado || "Sin problema reportado"}
                  </div>

                  {orden.observaciones && (
                    <div style={notesStyle}>{orden.observaciones}</div>
                  )}

                  <div style={moneyRowStyle}>
                    <span>Total: <strong>{formatMoney(orden.total_final)}</strong></span>
                    <span>Saldo: <strong>{formatMoney(orden.saldo_pendiente)}</strong></span>
                  </div>

                  <Link to={`/taller/${orden.id}`} style={detailLinkStyle}>
                    Ver orden
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatNullableDate(value) {
  return value ? formatDate(value) : "-";
}

function getUltimoEventoBicicleta(timeline, historialTaller, ventaOrigen) {
  const eventos = [
    ...(timeline || []).map((evento) => ({
      fecha: evento.fecha,
      titulo: evento.titulo || evento.tipo,
    })),
    ...(historialTaller || []).map((orden) => ({
      fecha: orden.fecha_ingreso,
      titulo: `Orden #${orden.id}`,
    })),
    ventaOrigen
      ? {
          fecha: ventaOrigen.fecha,
          titulo: `Venta #${ventaOrigen.id}`,
        }
      : null,
  ].filter((evento) => evento?.fecha);

  return eventos.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )[0] || null;
}

function BicicletaLecturaRapida({
  bicicleta,
  ventaOrigen,
  historialTaller,
  timeline,
  estadoPostventa,
  ultimoEvento,
}) {
  const otAbiertas = historialTaller.filter((orden) =>
    !["retirada", "cancelada"].includes(orden.estado)
  );

  return (
    <section style={quickCardStyle}>
      <QuickInfo
        label="Postventa"
        value={<BadgePostventa estado={estadoPostventa} />}
        detail={
          bicicleta?.id_orden_service_gratis
            ? `Usado en OT #${bicicleta.id_orden_service_gratis}`
            : formatNullableDate(bicicleta?.fecha_limite_service_gratis)
        }
      />
      <QuickInfo
        label="Origen"
        value={ventaOrigen ? `Venta #${ventaOrigen.id}` : "Manual"}
        detail={ventaOrigen ? formatMoney(ventaOrigen.total_final) : "Sin venta vinculada"}
      />
      <QuickInfo
        label="Taller"
        value={`${historialTaller.length} OT`}
        detail={otAbiertas.length > 0 ? `${otAbiertas.length} abierta(s)` : "Sin OT abierta"}
      />
      <QuickInfo
        label="Ultimo movimiento"
        value={ultimoEvento?.titulo || "-"}
        detail={ultimoEvento?.fecha ? formatDate(ultimoEvento.fecha) : `${timeline.length} evento(s)`}
      />
    </section>
  );
}

function QuickInfo({ label, value, detail }) {
  return (
    <div style={quickInfoStyle}>
      <span style={quickLabelStyle}>{label}</span>
      <strong style={quickValueStyle}>{value}</strong>
      <span style={quickDetailStyle}>{detail || "-"}</span>
    </div>
  );
}

function labelCondicionEntrega(value) {
  switch (value) {
    case "armada":
      return "Armada";
    case "en_caja":
      return "En caja";
    default:
      return "-";
  }
}

function labelPlanPostventa(value) {
  switch (value) {
    case "service_30_dias":
      return "Service bonificado 30 días";
    case "garantia_fabrica":
      return "Garantía de fábrica";
    case "sin_service":
      return "Sin service bonificado";
    default:
      return "-";
  }
}

function calcularEstadoPostventa(bicicleta) {
  if (!bicicleta || bicicleta.plan_postventa !== "service_30_dias") {
    return {
      label: "No aplica",
      color: "#667085",
      background: "#f2f4f7",
      border: "#d0d5dd",
    };
  }

  if (bicicleta.service_gratis_usado) {
    return {
      label: "Usado",
      color: "#137333",
      background: "#ecfdf3",
      border: "#abefc6",
    };
  }

  if (bicicleta.service_gratis_autorizado_fuera_plazo) {
    return {
      label: "Autorizado",
      color: "#175cd3",
      background: "#eff8ff",
      border: "#b2ddff",
    };
  }

  if (bicicleta.fecha_limite_service_gratis) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const limite = new Date(`${bicicleta.fecha_limite_service_gratis}T00:00:00`);

    if (limite < hoy) {
      return {
        label: "Vencido",
        color: "#b42318",
        background: "#fef3f2",
        border: "#fecdca",
      };
    }
  }

  return {
    label: "Disponible",
    color: "#175cd3",
    background: "#eff8ff",
    border: "#b2ddff",
  };
}

function BadgePostventa({ estado }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        padding: "6px 10px",
        borderRadius: "999px",
        fontWeight: 900,
        fontSize: "12px",
        color: estado.color,
        background: estado.background,
        border: `1px solid ${estado.border}`,
      }}
    >
      {estado.label}
    </span>
  );
}


function PostventaActions({
  bicicleta,
  estadoPostventa,
  actionLoading,
  onAutorizar,
  onCrearService,
}) {
  const puedeCrear =
    bicicleta?.plan_postventa === "service_30_dias" &&
    !bicicleta?.service_gratis_usado &&
    ["Disponible", "Autorizado"].includes(estadoPostventa.label);

  const puedeAutorizar =
    bicicleta?.plan_postventa === "service_30_dias" &&
    !bicicleta?.service_gratis_usado &&
    estadoPostventa.label === "Vencido";

  if (bicicleta?.service_gratis_usado) {
    return (
      <div style={postventaActionBoxStyle}>
        Service bonificado utilizado
        {bicicleta.id_orden_service_gratis ? (
          <>
            {" · "}
            <Link to={`/taller/${bicicleta.id_orden_service_gratis}`} style={detailLinkStyle}>
              Ver orden #{bicicleta.id_orden_service_gratis}
            </Link>
          </>
        ) : null}
      </div>
    );
  }

  if (puedeCrear) {
    return (
      <div style={postventaActionBoxStyle}>
        <div style={postventaActionTextStyle}>
          <span style={actionLabelStyle}>Accion principal</span>
          <strong>Service bonificado disponible</strong>
          <span>Crealo desde aca para que quede vinculado a esta bicicleta y despues se marque como usado automaticamente.</span>
        </div>
        <button
          type="button"
          onClick={onCrearService}
          disabled={actionLoading}
          style={postventaPrimaryBtnStyle}
        >
          {actionLoading ? "Creando OT..." : "Crear OT service postventa"}
        </button>
      </div>
    );
  }

  if (puedeAutorizar) {
    return (
      <div style={postventaActionBoxStyle}>
        <div style={mutedStyle}>
          El service está vencido. Para usarlo gratis necesitás registrar una excepción.
        </div>
        <button
          type="button"
          onClick={onAutorizar}
          disabled={actionLoading}
          style={warningBtnStyle}
        >
          {actionLoading ? "Autorizando..." : "Autorizar excepción"}
        </button>
      </div>
    );
  }

  return null;
}


function Info({ label, value, full = false }) {
  return (
    <div
      style={{
        ...infoCardStyle,
        gridColumn: full ? "1 / -1" : "auto",
      }}
    >
      <div style={infoLabelStyle}>{label}</div>
      <div>{value}</div>
    </div>
  );
}



function colorEstado(estado) {
  switch (estado) {
    case "ingresada":
    case "creada":
      return "#b26a00";
    case "presupuestada":
    case "esperando_aprobacion":
    case "esperando_repuestos":
    case "pagada_parcial":
      return "#8a6d00";
    case "en_reparacion":
    case "pagada_total":
      return "#1565c0";
    case "terminada":
    case "lista_para_retirar":
    case "retirada":
    case "entregada":
      return "#137333";
    case "cancelada":
    case "anulada":
      return "#b42318";
    default:
      return "#444";
  }
}

function badgeEstado(estado) {
  const color = colorEstado(estado);

  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    fontWeight: 800,
    fontSize: "12px",
    background: "#f3f4f6",
    color,
    border: `1px solid ${color}33`,
    whiteSpace: "nowrap",
  };
}

const pageStyle = {
  padding: "24px",
  background: "#f6f7fb",
  minHeight: "100vh",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "18px",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: "30px",
};

const subtitleStyle = {
  margin: "6px 0 0",
  color: "#667085",
};

const actionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.4fr) minmax(320px, .9fr)",
  gap: "16px",
  marginBottom: "16px",
};

const quickCardStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const quickInfoStyle = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "14px",
  display: "grid",
  gap: "6px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  minWidth: 0,
};

const quickLabelStyle = {
  color: "#667085",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const quickValueStyle = {
  color: "#111827",
  fontSize: "17px",
  overflowWrap: "anywhere",
};

const quickDetailStyle = {
  color: "#667085",
  fontSize: "13px",
  fontWeight: 700,
  overflowWrap: "anywhere",
};

const cardStyle = {
  background: "white",
  borderRadius: "14px",
  border: "1px solid #eaecf0",
  padding: "16px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  marginBottom: "16px",
};

const cardTitleStyle = {
  margin: "0 0 14px",
  fontSize: "20px",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "14px",
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const infoCardStyle = {
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "12px",
};

const infoLabelStyle = {
  fontSize: "13px",
  color: "#667085",
  marginBottom: "6px",
};

const editFormStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
};

const fieldStyle = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 900,
  color: "#344054",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  padding: "10px 12px",
  fontWeight: 800,
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  fontFamily: "inherit",
};

const editActionsStyle = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap",
};

const originBoxStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
  display: "grid",
  gap: "12px",
};

const originMetaStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const timelineStyle = {
  display: "grid",
  gap: "12px",
};

const timelineItemStyle = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  gap: "10px",
};

const timelineDotStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#0b5bd3",
  marginTop: "16px",
  justifySelf: "center",
};

const timelineCardStyle = {
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "14px",
  background: "#fff",
  display: "grid",
  gap: "10px",
};

const timelineHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  flexWrap: "wrap",
};

const problemStyle = {
  fontWeight: 800,
};

const notesStyle = {
  background: "#f9fafb",
  border: "1px solid #eaecf0",
  borderRadius: "10px",
  padding: "10px",
  color: "#475467",
};

const moneyRowStyle = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
  color: "#344054",
};

const mutedStyle = {
  color: "#667085",
  fontSize: "13px",
};

const detailLinkStyle = {
  textDecoration: "none",
  fontWeight: 800,
  color: "#175cd3",
};

const primaryLinkStyle = {
  textDecoration: "none",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
};

const secondaryLinkStyle = {
  textDecoration: "none",
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
};

const secondaryBtnStyle = {
  border: "1px solid #d0d5dd",
  background: "white",
  color: "#344054",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 800,
  cursor: "pointer",
};


const postventaActionBoxStyle = {
  marginTop: "14px",
  border: "1px solid #bfdbfe",
  background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
  borderRadius: "14px",
  padding: "14px",
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
  fontWeight: 800,
};

const technicalNotesGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const technicalRecommendationStyle = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid #bbf7d0",
  borderRadius: 14,
  background: "#f0fdf4",
};

const technicalAlertStyle = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid #fed7aa",
  borderRadius: 14,
  background: "#fff7ed",
};

const technicalNoteTextStyle = {
  margin: 0,
  color: "#1e293b",
  lineHeight: 1.5,
  fontWeight: 750,
  whiteSpace: "pre-wrap",
};

const postventaActionTextStyle = {
  display: "grid",
  gap: "3px",
  minWidth: "240px",
  flex: "1 1 280px",
  color: "#344054",
};

const actionLabelStyle = {
  color: "#175cd3",
  fontSize: "12px",
  fontWeight: 1000,
  textTransform: "uppercase",
};

const primaryBtnStyle = {
  border: "1px solid #0b5bd3",
  background: "#0b5bd3",
  color: "white",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const postventaPrimaryBtnStyle = {
  ...primaryBtnStyle,
  padding: "12px 16px",
  boxShadow: "0 10px 22px rgba(11,91,211,.18)",
};

const warningBtnStyle = {
  border: "1px solid #f79009",
  background: "#fffbeb",
  color: "#b54708",
  borderRadius: "10px",
  padding: "10px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const alertStyle = {
  background: "#fff1f0",
  color: "#b42318",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #f4c7c3",
  marginBottom: "14px",
};

const emptyStyle = {
  color: "#667085",
  padding: "12px 0",
};
