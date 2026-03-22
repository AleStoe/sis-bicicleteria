from fastapi import APIRouter
from app.modules.catalogo.routes import router as catalogo_router
from app.modules.stock.routes import router as stock_router
from app.modules.ventas.routes import router as ventas_router
from app.modules.pagos.routes import router as pagos_router
from app.modules.caja.routes import router as caja_router
from app.modules.clientes.routes import router as clientes_router

router = APIRouter()

router.include_router(catalogo_router, prefix="/catalogo", tags=["Catalogo"])
router.include_router(stock_router, prefix="/stock", tags=["Stock"])
router.include_router(ventas_router, prefix="/ventas", tags=["Ventas"])
router.include_router(pagos_router, prefix="/pagos", tags=["Pagos"])
router.include_router(caja_router, prefix="/cajas", tags=["Caja"])
router.include_router(clientes_router, prefix="/clientes", tags=["Clientes"])