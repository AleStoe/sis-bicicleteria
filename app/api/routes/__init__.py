from fastapi import APIRouter
from app.modules.catalogo.routes import router as catalogo_router
from app.modules.stock.routes import router as stock_router
from app.modules.ventas.routes import router as ventas_router
from app.modules.pagos.routes import router as pagos_router
from app.modules.caja.routes import router as caja_router
from app.modules.clientes.routes import router as clientes_router
from app.modules.reservas.routes import router as reservas_router
from app.modules.taller.routes import router as taller_router
from app.modules.deudas.routes import router as deudas_router
from app.modules.serializadas.routes import router as serializadas_router
from app.modules.creditos.routes import router as creditos_router
from app.modules.gastos.routes import router as gastos_router
from app.modules.precios.routes import router as precios_router
from app.modules.proveedores.routes import router as proveedores_router
from app.modules.reglas_comerciales.routes import router as reglas_comerciales_router
from app.modules.documentos.routes import router as documentos_router
from app.modules.servicios_taller.routes import router as servicios_taller_router
from app.modules.capital_retiros.routes import router as capital_retiros_router
from app.modules.rentabilidad.routes import router as rentabilidad_router


router = APIRouter()

router.include_router(catalogo_router, prefix="/catalogo", tags=["Catalogo"])
router.include_router(stock_router, prefix="/stock", tags=["Stock"])
router.include_router(ventas_router, prefix="/ventas", tags=["Ventas"])
router.include_router(pagos_router, prefix="/pagos", tags=["Pagos"])
router.include_router(caja_router, prefix="/cajas", tags=["Caja"])
router.include_router(clientes_router, prefix="/clientes", tags=["Clientes"])
router.include_router(reservas_router, prefix="/reservas", tags=["Reservas"])
router.include_router(taller_router, tags=["Taller"])
router.include_router(deudas_router, prefix="/deudas", tags=["Deudas"])
router.include_router(serializadas_router,prefix="/bicicletas_serializadas", tags=["Bicicletas Serializadas"],)
router.include_router(creditos_router, prefix="/creditos", tags=["Creditos"])
router.include_router(gastos_router, prefix="/gastos", tags=["Gastos"])
router.include_router(precios_router, prefix="/precios", tags=["Precios"])
router.include_router(proveedores_router, prefix="/proveedores", tags=["Proveedores"])
router.include_router(reglas_comerciales_router, prefix="/reglas-comerciales", tags=["Reglas Comerciales"],)
router.include_router(documentos_router,prefix="/documentos", tags=["Documentos"],)
router.include_router(servicios_taller_router,prefix="/servicios_taller",tags=["Servicios Taller"],)
router.include_router(capital_retiros_router, prefix="/capital-retiros", tags=["Capital y Retiros"],)
router.include_router(rentabilidad_router, prefix="/rentabilidad", tags=["Rentabilidad"],)