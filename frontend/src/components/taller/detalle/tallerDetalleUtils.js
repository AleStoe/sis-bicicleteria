export function labelEstado(estado) {
  const labels = {
    ingresada: "Ingresada",
    presupuestada: "Presupuestada",
    esperando_aprobacion: "Esperando aprobación",
    esperando_repuestos: "Esperando repuestos",
    en_reparacion: "En reparación",
    terminada: "Terminada",
    facturada: "Facturada",
    lista_para_retirar: "Lista para retirar",
    retirada: "Retirada",
    cancelada: "Cancelada",
  };
  return labels[estado] || estado;
}

export function labelEtapa(etapa) {
  const labels = {
    presupuestado: "Presupuestado",
    agregado: "Aprobado",
    ejecutado: "Ejecutado",
    cancelado: "Cancelado",
  };
  return labels[etapa] || etapa;
}

export function humanizarEvento(evento) {
  return String(evento || "").replaceAll("_", " ");
}

export function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function esBicicletaCatalogo(item) {
  const texto = normalizarTexto(
    [
      item?.producto_nombre,
      item?.nombre_variante,
      item?.categoria_nombre,
      item?.tipo_bicicleta,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return (
    Boolean(item?.serializable) ||
    texto.includes("bicicleta") ||
    texto.includes("bici ")
  );
}

export function esItemPermitidoParaTaller(item) {
  const texto = normalizarTexto(
    [item?.categoria_nombre, item?.tipo_item, item?.producto_nombre]
      .filter(Boolean)
      .join(" ")
  );

  return !esBicicletaCatalogo(item) && !texto.includes("servicio");
}

export function tipoTallerLabel(item) {
  const texto = normalizarTexto(
    [item?.categoria_nombre, item?.tipo_item, item?.producto_nombre]
      .filter(Boolean)
      .join(" ")
  );

  if (texto.includes("servicio")) return "Servicio";
  if (texto.includes("repuesto")) return "Repuesto";
  if (texto.includes("accesorio")) return "Accesorio";
  return item?.tipo_item === "servicio" ? "Servicio" : "Insumo";
}

export function prioridadTipoTaller(item) {
  const tipo = tipoTallerLabel(item);
  if (tipo === "Servicio") return 1;
  if (tipo === "Repuesto") return 2;
  if (tipo === "Accesorio") return 3;
  return 4;
}

function esOrdenPostventa(orden) {
  return orden?.es_service_postventa === true;
}

export function getPasoOperativo(orden, resumen) {
  if (!orden) {
    return {
      numero: 1,
      titulo: "Cargando orden",
      descripcion: "Esperá a que el sistema cargue la información.",
    };
  }

  const esPostventa = esOrdenPostventa(orden);

  if (orden.estado === "cancelada") {
    return {
      numero: 1,
      titulo: "Orden cancelada",
      descripcion: "No hay acciones operativas disponibles para esta orden.",
    };
  }

  if (orden.estado === "retirada") {
    return {
      numero: 6,
      titulo: "Bicicleta retirada",
      descripcion: esPostventa
        ? "Service postventa finalizado y marcado como utilizado."
        : "Circuito terminado. No deberían hacerse más cambios operativos.",
    };
  }

  if (orden.estado === "lista_para_retirar") {
    return {
      numero: 6,
      titulo: "Lista para entregar",
      descripcion: esPostventa
        ? "Avisá al cliente y marcá la retirada cuando se lleve la bicicleta."
        : "La venta ya fue generada. Confirmá la retirada cuando el cliente se lleve la bicicleta.",
    };
  }

  if (orden.estado === "facturada") {
    return {
      numero: 5,
      titulo: "Cobro y retiro",
      descripcion:
        "La venta ya existe. Cobrá la venta y luego marcá la orden como lista para retirar.",
    };
  }

  if (orden.estado === "terminada") {
    return {
      numero: 4,
      titulo: esPostventa ? "Revisión terminada" : "Trabajo terminado",
      descripcion: esPostventa
        ? "El service postventa está terminado. Podés marcar la bicicleta como lista para retirar."
        : "Ahora corresponde generar la venta. No marques lista para retirar antes de facturar.",
    };
  }

  if (orden.estado === "en_reparacion") {
    if (esPostventa) {
      return {
        numero: 3,
        titulo: "Revisión en curso",
        descripcion:
          "Realizá el control post entrega y marcá la revisión como terminada.",
      };
    }

    if (
      resumen.pendientesEjecucion > 0 ||
      resumen.pendientesAprobacion > 0 ||
      resumen.activos === 0
    ) {
      return {
        numero: 3,
        titulo: "Ejecutar trabajo",
        descripcion:
          "Aprobá y ejecutá todos los items activos antes de marcar la orden como terminada.",
      };
    }

    return {
      numero: 3,
      titulo: "Trabajo listo para terminar",
      descripcion:
        "Todos los items activos están ejecutados. Ya podés marcar el trabajo como terminado.",
    };
  }

  if (
    orden.estado === "presupuestada" ||
    orden.estado === "esperando_aprobacion"
  ) {
    return {
      numero: 2,
      titulo: esPostventa ? "Ingreso registrado" : "Presupuesto pendiente",
      descripcion: esPostventa
        ? "Primer service bonificado. Podés iniciar la revisión sin cargar ítems."
        : "Revisá items, aprobaciones y pasá la orden a reparación cuando corresponda.",
    };
  }

  return {
    numero: 1,
    titulo: esPostventa ? "Service postventa" : "Ingreso de orden",
    descripcion: esPostventa
      ? "Primer service bonificado. Registrá el ingreso y continuá con la revisión."
      : "Cargá repuestos o servicios, imprimí presupuesto y pasá a presupuestada.",
  };
}

export function getAccionPrincipal({
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
}) {
  if (!orden || orden.estado === "cancelada" || orden.estado === "retirada") {
    return {
      label: null,
      mensaje: "Sin acciones principales disponibles.",
      tipo: "info",
    };
  }

  const esPostventa = esOrdenPostventa(orden);

  if (orden.estado === "ingresada") {
    return {
      label: esPostventa ? "Registrar ingreso" : "Marcar presupuestada",
      onClick: onPasarPresupuestada,
      disabled: esPostventa ? false : resumen.activos === 0,
      mensaje: esPostventa
        ? "Primer service bonificado. No requiere presupuesto ni carga de ítems."
        : resumen.activos === 0
          ? "Cargá al menos un repuesto o servicio antes de presupuestar."
          : "Siguiente paso recomendado: presupuestar.",
      tipo: !esPostventa && resumen.activos === 0 ? "warning" : "info",
    };
  }

  if (
    orden.estado === "presupuestada" ||
    orden.estado === "esperando_aprobacion"
  ) {
    return {
      label: esPostventa ? "Iniciar revisión" : "Pasar a reparación",
      onClick: onPasarEnReparacion,
      disabled: esPostventa
        ? false
        : resumen.activos === 0 || resumen.pendientesAprobacion > 0,
      mensaje: esPostventa
        ? "Continuá con la revisión postventa de la bicicleta."
        : resumen.pendientesAprobacion > 0
          ? "Hay items sin aprobar. Aprobá o cancelá antes de reparar."
          : "Cuando el cliente aprueba, pasá la orden a reparación.",
      tipo: resumen.pendientesAprobacion > 0 && !esPostventa ? "warning" : "info",
    };
  }

  if (orden.estado === "en_reparacion") {
    return {
      label: esPostventa ? "Finalizar revisión" : "Marcar trabajo terminado",
      onClick: onTerminar,
      disabled: esPostventa ? false : !puedeTerminarTrabajo,
      mensaje: esPostventa
        ? "Cuando termines el control post entrega, marcá la revisión como finalizada."
        : !puedeTerminarTrabajo
          ? "Para terminar, todos los items activos deben estar aprobados y ejecutados."
          : "Todo ejecutado. Ya podés marcar el trabajo como terminado.",
      tipo: !esPostventa && !puedeTerminarTrabajo ? "warning" : "info",
    };
  }

  if (orden.estado === "terminada") {
    return {
      label: esPostventa ? "Marcar lista para retirar" : "Generar venta",
      onClick: esPostventa ? onListaParaRetirar : onGenerarVenta,
      disabled: esPostventa ? !puedeMarcarListaParaRetirar : !puedeGenerarVenta,
      mensaje: esPostventa
        ? "Service postventa terminado. Ya podés avisar al cliente para retirar."
        : resumen.facturables === 0
          ? "No hay items ejecutados para facturar."
          : "Generá la venta antes de marcar la orden como lista para retirar.",
      tipo: esPostventa
        ? "info"
        : resumen.facturables === 0
          ? "warning"
          : "info",
    };
  }

  if (orden.estado === "facturada") {
    return {
      label: "Cobrar venta",
      onClick: onCobrar,
      disabled: !orden.id_venta_generada,
      secondaryLabel: "Marcar lista para retirar",
      secondaryOnClick: onListaParaRetirar,
      secondaryDisabled: !puedeMarcarListaParaRetirar,
      mensaje:
        "Cobrada o con deuda autorizada, marcá la bicicleta como lista para retirar.",
      tipo: "info",
    };
  }

  if (orden.estado === "lista_para_retirar") {
    return {
      label: "Marcar retirada",
      onClick: onRetirada,
      disabled: !puedeMarcarRetirada,
      mensaje: esPostventa
        ? "Al retirar, el service bonificado quedará marcado como utilizado."
        : "Usá este paso cuando el cliente efectivamente retire la bicicleta.",
      tipo: "info",
    };
  }

  return {
    label: null,
    mensaje: "Revisá el estado actual de la orden.",
    tipo: "info",
  };
}

export function nombreClienteOrden(orden) {
  return orden?.cliente_nombre || `Cliente #${orden?.id_cliente}`;
}

export function descripcionBicicletaOrden(orden) {
  if (orden?.bicicleta_descripcion) return orden.bicicleta_descripcion;

  const partes = [
    orden?.bicicleta_marca,
    orden?.bicicleta_modelo,
    orden?.bicicleta_rodado ? `R${orden.bicicleta_rodado}` : null,
    orden?.bicicleta_color,
  ].filter(Boolean);

  return partes.length > 0
    ? partes.join(" ")
    : `Bicicleta #${orden?.id_bicicleta_cliente}`;
}
