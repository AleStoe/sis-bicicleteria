from fastapi import APIRouter
from app.modules.catalogo.routes import router as catalogo_router
from app.modules.stock.routes import router as stock_router
from app.modules.ventas.routes import router as ventas_router


router = APIRouter()

router.include_router(catalogo_router, prefix="/catalogo", tags=["Catalogo"])
router.include_router(stock_router, prefix="/stock", tags=["Stock"])
router.include_router(ventas_router, prefix="/ventas", tags=["Ventas"])