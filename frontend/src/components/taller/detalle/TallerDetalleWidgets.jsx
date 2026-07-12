import { useState } from "react";
import ProductImage from "../../catalogo/ProductImage";
import ServicePlaceholder from "../../servicios/ServicePlaceholder";
import { formatMoney, formatNumber } from "../../../utils/formatters";
import { esVarianteUnica } from "../../../utils/productPresentation";
import { styles } from "./tallerDetalleStyles";
import {
  getPasoOperativo,
  getAccionPrincipal,
  labelEstado,
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
  onEjecutarPendientes,
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
    onEjecutarPendientes,
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
    ? ["Ingreso", "Registro", "Revision", "Terminada", "Aviso", "Retiro"]
    : ["Ingreso", "Presupuesto", "Reparacion", "Facturar", "Cobrar", "Retiro"];

  return (
    <section style={{ ...styles.card, ...styles.operatorCard, ...(compact ? styles.operatorCardCompact : {}) }}>
      <div style={styles.operatorHeader}>
        <div>
          <p style={styles.eyebrow}>Estado de la orden</p>
          <h2 style={styles.sideTitle}>{labelEstado(orden.estado)}</h2>
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
          <div style={styles.operatorProgressLine}>
            {pasos.map((label, index) => {
              const numero = index + 1;
              const activo = numero <= paso.numero;
              return (
                <div key={label} style={styles.operatorProgressStep}>
                  <span style={activo ? styles.progressDotActive : styles.progressDot}>
                    {numero}
                  </span>
                  <small>{label}</small>
                </div>
              );
            })}
          </div>

          <div style={styles.operatorStatsBox}>
            <OperatorStat tone="ok" label="Aprobados" value={resumen.aprobados} />
            <OperatorStat tone="warning" label="Pendientes" value={resumen.pendientesAprobacion} />
            <OperatorStat tone="info" label="Ejecutados" value={resumen.ejecutados} />
            <OperatorStat tone="danger" label="Cancelados" value={resumen.cancelados} />
            <OperatorStat tone="dark" label="Total" value={resumen.items} />
          </div>

          <div style={styles.operatorRecommendation}>
            <span style={styles.operatorRecommendationIcon}>!</span>
            <div>
              <strong>Proxima accion recomendada</strong>
              <p style={styles.operatorRecommendationText}>{paso.descripcion}</p>
            </div>
          </div>

          {accion.mensaje && (
            <div style={accion.tipo === "warning" ? styles.operatorWarning : styles.operatorInfo}>
              {accion.mensaje}
            </div>
          )}
        </>
      )}

      {accion.label && (
        <div style={styles.operatorMainAction}>
          <span style={styles.operatorMainActionLabel}>Accion principal</span>
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
        </div>
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

function OperatorStat({ label, value, tone }) {
  const toneStyle = styles.operatorStatTones[tone] || styles.operatorStatTones.dark;
  return (
    <div style={styles.operatorStat}>
      <span style={{ ...styles.operatorStatIcon, ...toneStyle.icon }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

export function ServicioTallerOption({ servicio, selected, onSelect, onDoubleAdd }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onDoubleAdd}
      style={selected ? styles.tallerOptionSelected : styles.tallerOption}
      title="Doble click para agregar"
    >
      <div style={styles.optionImageBox}>
        <ServicePlaceholder />
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

export function TallerItemOption({ item, selected, onSelect, onDoubleAdd }) {
  const tipo = tipoTallerLabel(item);
  const esServicio = tipo === "Servicio";

  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onDoubleAdd}
      style={selected ? styles.tallerOptionSelected : styles.tallerOption}
      title="Doble click para agregar"
    >
      <div style={styles.optionImageBox}>
        {esServicio ? (
          <ServicePlaceholder />
        ) : (
          <ProductImage url={item.imagen_principal} size={54} />
        )}
      </div>

      <div style={styles.optionBody}>
        <div style={styles.optionTop}>
          <strong>{item.producto_nombre}</strong>
          <span style={tipo === "Servicio" ? styles.serviceBadge : styles.partBadge}>{tipo}</span>
        </div>
        {!esVarianteUnica(item.nombre_variante) && item.nombre_variante && (
          <p>{item.nombre_variante}</p>
        )}
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
          {Number(item.valor_cobertura_unitario || 0) > 0 ? (
            <div style={styles.coverageSummary}>
              <span>
                Cobertura {item.motivo_cobertura}: -
                {formatMoney(
                  Number(item.valor_cobertura_unitario) *
                    Number(item.cantidad || 1),
                )}
              </span>
              <strong>Diferencia a cobrar: {formatMoney(item.subtotal)}</strong>
              {item.observacion_cobertura ? (
                <small>{item.observacion_cobertura}</small>
              ) : null}
            </div>
          ) : null}
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
