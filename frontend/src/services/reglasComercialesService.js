import { apiRequest } from "./api";

export function listarReglasComerciales(soloActivas = false) {
  return apiRequest(`/reglas-comerciales?solo_activas=${soloActivas}`);
}

export function crearReglaComercial(data) {
  return apiRequest("/reglas-comerciales", {
    method: "POST",
    body: JSON.stringify(data),
  }).then(limpiarCachePreciosCatalogo);
}

export function editarReglaComercial(reglaId, data) {
  return apiRequest(`/reglas-comerciales/${reglaId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then(limpiarCachePreciosCatalogo);
}

export function listarTarjetaPlanes(soloActivos = false) {
  return apiRequest(
    `/reglas-comerciales/tarjeta-planes?solo_activos=${soloActivos}`
  );
}

export function crearTarjetaPlan(data) {
  return apiRequest(`/reglas-comerciales/tarjeta-planes`, {
    method: "POST",
    body: JSON.stringify(data),
  }).then(limpiarCachePreciosCatalogo);
}

export function editarTarjetaPlan(planId, data) {
  return apiRequest(`/reglas-comerciales/tarjeta-planes/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then(limpiarCachePreciosCatalogo);
}

export function simularReglasComerciales(data) {
  return apiRequest("/reglas-comerciales/simular", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

const preciosCatalogoCache = new Map();
let planesCatalogoPromise = null;

function limpiarCachePreciosCatalogo(resultado) {
  preciosCatalogoCache.clear();
  planesCatalogoPromise = null;
  return resultado;
}

function numeroPrecio(value) {
  const numero = Number(value || 0);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function obtenerPlanesCatalogo() {
  if (!planesCatalogoPromise) {
    planesCatalogoPromise = listarTarjetaPlanes(true).catch((error) => {
      planesCatalogoPromise = null;
      throw error;
    });
  }
  return planesCatalogoPromise;
}

function elegirPlanCuotas(planes, cuotas) {
  const candidatos = (planes || []).filter(
    (plan) =>
      plan.medio_pago === "tarjeta" &&
      Number(plan.cuotas) === Number(cuotas)
  );

  return candidatos.find((plan) => !plan.entidad) || candidatos[0] || null;
}

function agregarEscenario(escenarios, key, medioPago, montoBase, extra = {}) {
  if (montoBase <= 0) return;
  escenarios.push({
    key,
    payload: {
      medio_pago: medioPago,
      monto_base: montoBase,
      ...extra,
    },
  });
}

function porcentajeDescuentoPara(resultado, medioPago) {
  const porcentajes = (resultado.reglas_aplicadas || [])
    .filter(
      (regla) =>
        regla.tipo === "descuento" &&
        (regla.medio_pago === medioPago || regla.medio_pago == null) &&
        regla.porcentaje_aplicado != null
    )
    .map((regla) => Number(regla.porcentaje_aplicado))
    .filter(Number.isFinite);

  const unicos = [...new Set(porcentajes)];
  return unicos.length === 1 ? unicos[0] : null;
}

function resumirContado(resultado, escenariosPorKey, prefijo) {
  const efectivo = escenariosPorKey[`${prefijo}_efectivo`];
  const transferencia = escenariosPorKey[`${prefijo}_transferencia`];
  const opciones = [];

  if (efectivo) {
    opciones.push({
      medio: "efectivo",
      label: "Efectivo",
      monto: Number(efectivo.monto_total_cobrado),
      descuento: Number(efectivo.descuento_aplicado || 0),
      porcentajeDescuento: porcentajeDescuentoPara(resultado, "efectivo"),
    });
  }

  if (transferencia) {
    opciones.push({
      medio: "transferencia",
      label: "Transferencia",
      monto: Number(transferencia.monto_total_cobrado),
      descuento: Number(transferencia.descuento_aplicado || 0),
      porcentajeDescuento: porcentajeDescuentoPara(resultado, "transferencia"),
    });
  }

  if (
    opciones.length === 2 &&
    Math.abs(opciones[0].monto - opciones[1].monto) < 0.01 &&
    Math.abs(opciones[0].descuento - opciones[1].descuento) < 0.01
  ) {
    return [
      {
        ...opciones[0],
        medio: "contado",
        label: "Contado / Transferencia",
      },
    ];
  }

  return opciones;
}

async function cargarPreciosComercialesCatalogo(
  precioMinorista,
  precioMayorista
) {
  const planes = await obtenerPlanesCatalogo();
  const plan3 = elegirPlanCuotas(planes, 3);
  const plan6 = elegirPlanCuotas(planes, 6);
  const escenarios = [];

  agregarEscenario(
    escenarios,
    "minorista_efectivo",
    "efectivo",
    precioMinorista
  );
  agregarEscenario(
    escenarios,
    "minorista_transferencia",
    "transferencia",
    precioMinorista
  );
  if (plan3) {
    agregarEscenario(
      escenarios,
      "minorista_tarjeta_3",
      "tarjeta",
      precioMinorista,
      { cuotas: 3, entidad: plan3.entidad || undefined }
    );
  }
  if (plan6) {
    agregarEscenario(
      escenarios,
      "minorista_tarjeta_6",
      "tarjeta",
      precioMinorista,
      { cuotas: 6, entidad: plan6.entidad || undefined }
    );
  }
  agregarEscenario(
    escenarios,
    "mayorista_efectivo",
    "efectivo",
    precioMayorista
  );
  agregarEscenario(
    escenarios,
    "mayorista_transferencia",
    "transferencia",
    precioMayorista
  );

  if (!escenarios.length) {
    return {
      minorista: null,
      mayorista: null,
    };
  }

  const resultado = await simularReglasComerciales({
    subtotal_base: escenarios.reduce(
      (total, escenario) => total + escenario.payload.monto_base,
      0
    ),
    medios_pago: escenarios.map((escenario) => escenario.payload),
  });

  const escenariosPorKey = {};
  escenarios.forEach((escenario, index) => {
    escenariosPorKey[escenario.key] = resultado.tramos_pago?.[index] || null;
  });

  const tarjetasMinorista = [
    { cuotas: 3, tramo: escenariosPorKey.minorista_tarjeta_3 },
    { cuotas: 6, tramo: escenariosPorKey.minorista_tarjeta_6 },
  ]
    .filter((item) => item.tramo)
    .map(({ cuotas, tramo }) => ({
      cuotas,
      total: Number(tramo.monto_total_cobrado),
      importeCuota: Number(tramo.monto_total_cobrado) / cuotas,
      porcentajeFinanciacion:
        tramo.porcentaje_recargo_aplicado == null
          ? null
          : Number(tramo.porcentaje_recargo_aplicado),
    }));

  return {
    minorista:
      precioMinorista > 0
        ? {
            precioLista: precioMinorista,
            contado: resumirContado(
              resultado,
              escenariosPorKey,
              "minorista"
            ),
            tarjetas: tarjetasMinorista,
          }
        : null,
    mayorista:
      precioMayorista > 0
        ? {
            precioMayorista,
            contado: resumirContado(
              resultado,
              escenariosPorKey,
              "mayorista"
            ),
          }
        : null,
  };
}

export function obtenerPreciosComercialesCatalogo({
  precioMinorista,
  precioMayorista,
}) {
  const minorista = numeroPrecio(precioMinorista);
  const mayorista = numeroPrecio(precioMayorista);
  const cacheKey = `${minorista}|${mayorista}`;

  if (!preciosCatalogoCache.has(cacheKey)) {
    const promise = cargarPreciosComercialesCatalogo(
      minorista,
      mayorista
    ).catch((error) => {
      preciosCatalogoCache.delete(cacheKey);
      throw error;
    });
    preciosCatalogoCache.set(cacheKey, promise);
  }

  return preciosCatalogoCache.get(cacheKey);
}
