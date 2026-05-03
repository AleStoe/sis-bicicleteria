from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.db.connection import get_connection
from app.modules.auditoria.routes import router as auditoria_router

app = FastAPI(title="Sistema Bicicleteria Agus")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(auditoria_router, prefix="/auditoria", tags=["Auditoría"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    conn = get_connection()

    with conn.cursor() as cur:
        cur.execute("SELECT 1 AS test")
        result = cur.fetchone()

    conn.close()

    return {"database": result}