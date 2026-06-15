import { useState } from "react";
import ProductImage from "../../catalogo/ProductImage";
import { formatMoney, formatNumber } from "../../../utils/formatters";
import { styles } from "./tallerDetalleStyles";
import {
  getPasoOperativo,
  getAccionPrincipal,
  labelEtapa,
  tipoTallerLabel,
} from "./tallerDetalleUtils";

export function OperadorPanel({
  compact = false,
  orden,
  resumen,
  guardando,
  puedeTerminarTrabajo,
  puedeGenerarVenta,
  puedeMarcarListaParaRetirar,
  puedeMarcarRetirada,
  onPasarPresupuestada,
  onPasarEnReparacion,
  onTerminar,
  onGenerarVenta,
  onCobrar,
  onListaParaRetirar,
  onRetirada,
}) {
  const paso = getPasoOperativo(orden, resumen);
  const accion = getAccionPrincipal({
    orden,
    resumen,
    puedeTerminarTrabajo,
    puedeGenerarVenta,
    puedeMarcarListaParaRetirar,
    puedeMarcarRetirada,
    onPasarPresupuestada,
    onPasarEnReparacion,
    onTerminar,
    onGenerarVenta,
    onCobrar,
    onListaParaRetirar,
    onRetirada,
  });
  const [collapsed, setCollapsed] = useState(compact);
  const isCollapsed = compact && collapsed;
  const esPostventa = orden?.es_service_postventa === true;
  const pasos = esPostventa
    ? [
        ["1", "Ingreso"],
        ["2", "Registro"],
        ["3", "Revision"],
        ["4", "Terminada"],
        ["5", "Aviso"],
        ["6", "Retiro"],
      ]
    : [
        ["1", "Ingreso"],
        ["2", "Presupuesto"],
        ["3", "Reparacion"],
        ["4", "Facturar"],
        ["5", "Cobrar"],
        ["6", "Retiro"],
      ];

  return (
    <section style={{ ...styles.card, ...styles.operatorCard, ...(compact ? styles.operatorCardCompact : {}) }}>
      <div style={styles.operatorHeader}>
        <div>
          <p style={styles.eyebrow}>Guía del operador</p>
          <h2 style={styles.sideTitle}>{paso.titulo}</h2>
        </div>
        <div style={styles.operatorHeaderActions}>
          <span style={styles.operatorStep}>{paso.numero}/6</span>
          {compact && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              style={styles.operatorToggle}
            >
              {isCollapsed ? "Ver" : "Ocultar"}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <p style={styles.operatorText}>{paso.descripcion}</p>

          <div style={styles.operatorProgress}>
        {pasos.map(([numero, label]) => (
          <div
            key={numero}
            style={
              Number(numero) <= paso.numero
                ? styles.progressDotActive
                : styles.progressDot
            }
            title={label}
          >
            {numero}
          </div>
        ))}
      </div>

      <div style={styles.checkList}>
        {esPostventa ? (
          <>
            <CheckLine ok label="Service bonificado: sin presupuesto" />
            <CheckLine ok label="Sin venta ni saldo pendiente" />
            <CheckLine
              ok={orden.estado !== "ingresada"}
              label={orden.estado !== "ingresada" ? "Ingreso registrado" : "Registrar ingreso"}
            />
            <CheckLine
              ok={["terminada", "lista_para_retirar", "retirada"].includes(orden.estado)}
              label={
                ["terminada", "lista_para_retirar", "retirada"].includes(orden.estado)
                  ? "Revision finalizada"
                  : "Finalizar revision"
              }
            />
          </>
        ) : (
          <>
            <CheckLine
              ok={resumen.activos > 0}
              label={
                resumen.activos > 0
                  ? `${resumen.activos} item/s activos cargados`
                  : "Cargá al menos un item activo"
              }
            />
            <CheckLine
              ok={resumen.pendientesAprobacion === 0 && resumen.activos > 0}
              label={
                resumen.pendientesAprobacion === 0 && resumen.activos > 0
                  ? "Todo aprobado"
                  : `${resumen.pendientesAprobacion} item/s sin aprobar`
              }
            />
            <CheckLine
              ok={resumen.pendientesEjecucion === 0 && resumen.activos > 0}
              label={
                resumen.pendientesEjecucion === 0 && resumen.activos > 0
                  ? "Todo ejecutado"
                  : `${resumen.pendientesEjecucion} item/s aprobados sin ejecutar`
              }
            />
            <CheckLine
              ok={Boolean(orden.id_venta_generada)}
              label={
                orden.id_venta_generada
                  ? `Venta #${orden.id_venta_generada} generada`
                  : "Venta pendiente de generar"
              }
            />
          </>
        )}
      </div>

          {accion.mensaje && (
            <div style={accion.tipo === "warning" ? styles.operatorWarning : styles.operatorInfo}>
              {accion.mensaje}
            </div>
          )}
        </>
      )}

      {accion.label && (
        <button
          type="button"
          onClick={accion.onClick}
          disabled={guardando || accion.disabled}
          style={{
            ...styles.operatorPrimary,
            opacity: guardando || accion.disabled ? 0.55 : 1,
            cursor: guardando || accion.disabled ? "not-allowed" : "pointer",
          }}
        >
          {accion.label}
        </button>
      )}

      {accion.secondaryLabel && (
        <button
          type="button"
          onClick={accion.secondaryOnClick}
          disabled={guardando || accion.secondaryDisabled}
          style={{
            ...styles.operatorSecondary,
            opacity: guardando || accion.secondaryDisabled ? 0.55 : 1,
            cursor: guardando || accion.secondaryDisabled ? "not-allowed" : "pointer",
          }}
        >
          {accion.secondaryLabel}
        </button>
      )}
    </section>
  );
}

function CheckLine({ ok, label }) {
  return (
    <div style={styles.checkLine}>
      <span style={ok ? styles.checkOk : styles.checkPending}>
        {ok ? "✓" : "!"}
      </span>
      <span>{label}</span>
    </div>
  );
}

export function ServicioTallerOption({ servicio, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={selected ? styles.tallerOptionSelected : styles.tallerOption}
    >
      <div style={styles.optionImageBox}>
        <span style={styles.serviceIcon}>🛠</span>
      </div>

      <div style={styles.optionBody}>
        <div style={styles.optionTop}>
          <strong>{servicio.nombre}</strong>
          <span style={styles.serviceBadge}>{selected ? "Seleccionado" : "Servicio"}</span>
        </div>
        <p>{servicio.descripcion || "Servicio de taller"}</p>
        <div style={styles.optionMeta}>
          {servicio.duracion_estimada_min != null && <span>{servicio.duracion_estimada_min} min</span>}
          <span>Sin stock</span>
        </div>
      </div>

      <strong style={styles.optionPrice}>{formatMoney(servicio.precio_sugerido)}</strong>
    </button>
  );
}

export function TallerItemOption({ item, selected, onSelect }) {
  const tipo = tipoTallerLabel(item);
  const esServicio = tipo === "Servicio";

  return (
    <button
      type="button"
      onClick={onSelect}
      style={selected ? styles.tallerOptionSelected : styles.tallerOption}
    >
      <div style={styles.optionImageBox}>
        {esServicio ? (
          <span style={styles.serviceIcon}>🛠</span>
        ) : (
          <ProductImage url={item.imagen_principal} size={54} />
        )}
      </div>

      <div style={styles.optionBody}>
        <div style={styles.optionTop}>
          <strong>{item.producto_nombre}</strong>
          <span style={tipo === "Servicio" ? styles.serviceBadge : styles.partBadge}>{tipo}</span>
        </div>
        <p>{item.nombre_variante || "Única"}</p>
        <div style={styles.optionMeta}>
          {item.codigo_proveedor && <span>Prov: {item.codigo_proveedor}</span>}
          {item.sku && <span>SKU: {item.sku}</span>}
          {item.stock_disponible != null && !esServicio && <span>Stock: {formatNumber(item.stock_disponible)}</span>}
        </div>
      </div>

      <strong style={styles.optionPrice}>{formatMoney(item.precio_minorista)}</strong>
    </button>
  );
}

export function ItemCard({ item, guardando, onAprobar, onDesaprobar, onEjecutar, onRevertir, onCancelar }) {
  return (
    <article style={item.etapa === "cancelado" ? styles.itemCardMuted : styles.itemCard}>
      <div style={styles.itemTop}>
        <div>
          <div style={styles.itemTitleLine}>
            <span style={item.tipo_item === "servicio" ? styles.serviceBadge : styles.partBadge}>
              {item.tipo_item === "servicio" ? "Servicio" : "Repuesto"}
            </span>
            <strong style={styles.itemTitle}>{item.descripcion_snapshot}</strong>
          </div>
          <p style={styles.muted}>#{item.id} · Cantidad {formatNumber(item.cantidad)} · {formatMoney(item.precio_unitario)} c/u</p>
        </div>
        <EtapaBadge etapa={item.etapa} aprobado={item.aprobado} />
      </div>

      <div style={styles.itemBottom}>
        <strong>{formatMoney(item.subtotal)}</strong>
        <div style={styles.itemActions}>
          {item.etapa === "presupuestado" && (
            <>
              <button disabled={guardando} onClick={onAprobar} style={styles.smallPrimary}>Aprobar</button>
              <button disabled={guardando} onClick={onCancelar} style={styles.smallDanger}>Cancelar</button>
            </>
          )}

          {item.etapa === "agregado" && (
            <>
              <button disabled={guardando} onClick={onEjecutar} style={styles.smallPrimary}>Ejecutar</button>
              <button disabled={guardando} onClick={onDesaprobar} style={styles.smallSecondary}>Desaprobar</button>
              <button disabled={guardando} onClick={onCancelar} style={styles.smallDanger}>Cancelar</button>
            </>
          )}

          {item.etapa === "ejecutado" && <button disabled={guardando} onClick={onRevertir} style={styles.smallSecondary}>Revertir</button>}
          {item.etapa === "cancelado" && <span style={styles.smallMuted}>Sin acciones</span>}
        </div>
      </div>
    </article>
  );
}

function EtapaBadge({ etapa, aprobado }) {
  const tone = etapa === "ejecutado" ? "ok" : etapa === "agregado" ? "info" : etapa === "cancelado" ? "danger" : "warning";
  const label = etapa === "agregado" && aprobado ? "Aprobado" : labelEtapa(etapa);
  return <span style={{ ...styles.stageBadge, ...(styles.stageTones[tone] || {}) }}>{label}</span>;
}

export function Metric({ label, value, tone }) {
  return (
    <div style={{ ...styles.metric, ...(styles.metricTones[tone] || {}) }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
