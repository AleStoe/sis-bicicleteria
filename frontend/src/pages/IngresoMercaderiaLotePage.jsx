import { IngresoMercaderiaGuiadaPage } from "./IngresoBicicletasLotePage";

export default function IngresoMercaderiaLotePage() {
  return (
    <IngresoMercaderiaGuiadaPage
      tipoOperativo="no_bicicletas"
      titulo="Mercaderia por lote"
      subtitulo="Escanea accesorios, repuestos y productos ya cargados. Lo que no exista queda marcado para cargarlo por alta normal."
      entidadSingular="producto"
      entidadPlural="productos"
      rutaAlta="/mercaderia/alta"
      confirmacion="El stock queda cargado como ingreso fisico. Los productos nuevos deben cargarse primero por alta normal."
    />
  );
}
