export const FICHA_TECNICA_BICICLETA = [
  {
    grupo: "Identificación",
    campos: [
      "Marca",
      "Modelo",
      "Tipo bicicleta",
      "Rodado",
      "Talle",
      "Color",
    ],
  },
  {
    grupo: "Cuadro",
    campos: [
      "Material cuadro",
      "Caja pedalera",
    ],
  },
  {
    grupo: "Suspensión",
    campos: [
      "Horquilla",
      "Recorrido suspensión",
    ],
  },
  {
    grupo: "Transmisión",
    campos: [
      "Velocidades",
      "Cambio trasero",
      "Descarrilador",
      "Shifter",
      "Piñón",
      "Engranaje",
      "Cadena",
    ],
  },
  {
    grupo: "Frenos",
    campos: [
      "Tipo freno",
      "Freno delantero",
      "Freno trasero",
      "Discos",
    ],
  },
  {
    grupo: "Ruedas",
    campos: [
      "Mazas",
      "Llantas",
      "Rayos",
      "Cubiertas",
      "Medida cubiertas",
    ],
  },
  {
    grupo: "Componentes",
    campos: [
      "Stem",
      "Manubrio",
      "Portasilla",
      "Asiento",
      "Pedales",
      "Puños",
    ],
  },
  {
    grupo: "E-Bike",
    campos: [
      "Motor",
      "Potencia motor",
      "Batería",
      "Autonomía",
      "Display",
    ],
  },
  {
    grupo: "Otros",
    campos: [
      "Peso",
      "Incluye",
      "Garantía",
      "Observaciones",
    ],
  },
];

export function getCamposPorGrupo(grupo) {
  return (
    FICHA_TECNICA_BICICLETA.find((item) => item.grupo === grupo)?.campos || []
  );
}

export function normalizarCampoFicha(campo) {
  const limpio = String(campo || "").trim().toLowerCase();

  const equivalencias = {
    marca: "Marca",
    modelo: "Modelo",
    color: "Color",
    talle: "Talle",
    rodado: "Rodado",

    cuadro: "Material cuadro",
    "material cuadro": "Material cuadro",
    "material del cuadro": "Material cuadro",

    mazas: "Mazas",
    horquilla: "Horquilla",
    engranaje: "Engranaje",
    llantas: "Llantas",

    "manija de cambio": "Shifter",
    "manijas de cambio": "Shifter",
    shifter: "Shifter",

    "manija de freno": "Freno delantero",
    "manijas de freno": "Freno delantero",

    cambios: "Cambio trasero",
    cambio: "Cambio trasero",
    descarrilador: "Descarrilador",

    piñon: "Piñón",
    piñón: "Piñón",

    portasilla: "Portasilla",
    "portasilla (mm)": "Portasilla",

    velocidades: "Velocidades",

    "suspensión delantera": "Horquilla",
    "suspension delantera": "Horquilla",

    frenos: "Tipo freno",
    discos: "Discos",

    asiento: "Asiento",
    pedales: "Pedales",
    cubiertas: "Cubiertas",

    "caja pedalera": "Caja pedalera",
  };

  return equivalencias[limpio] || campo;
}

export function buscarGrupoPorCampo(campo) {
  const campoNormalizado = normalizarCampoFicha(campo);

  const grupo = FICHA_TECNICA_BICICLETA.find((item) =>
    item.campos.includes(campoNormalizado)
  );

  return grupo?.grupo || "Otros";
}