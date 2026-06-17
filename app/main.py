from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.auth import auth_middleware
from app.db.connection import get_connection
from app.modules.auditoria.routes import router as auditoria_router

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"

app = FastAPI(title="Sistema Bicicleteria Agus")

app.middleware("http")(auth_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^http://("
        r"localhost|127\.0\.0\.1|"
        r"sistema-agus|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(?::(80|8000|5173|5174|5175|5176|5177|5178|5179|4173))?$"
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(auditoria_router, prefix="/auditoria", tags=["Auditoría"])

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="uploads",
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS test")
            result = cur.fetchone()

        return {"database": result}

    finally:
        conn.close()
