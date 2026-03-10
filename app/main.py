from fastapi import FastAPI
from app.api.routes import router as api_router
from app.db.connection import get_connection
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Sistema Bicicleteria Agus")

app.include_router(api_router)


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)