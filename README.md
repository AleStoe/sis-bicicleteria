# Sistema Bicicleteria

Aplicacion de gestion para bicicleteria con backend FastAPI, PostgreSQL y frontend React/Vite.

## Requisitos

- Python 3.13
- PostgreSQL
- Node.js 20+

## Configuracion

1. Copiar `.env.example` a `.env`.
2. Ajustar credenciales de PostgreSQL.
3. Definir `APP_SECRET` con un valor largo y privado antes de usar la beta.

## Base de datos

Crear una base vacia y cargar el esquema:

```powershell
createdb bicicleteria_beta
psql -d bicicleteria_beta -f database_schema.sql
```

El archivo `database_schema.sql` contiene solo estructura, sin datos reales.

## Backend

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Para apuntar el frontend a otra API, crear `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Verificacion

```powershell
venv\Scripts\python.exe -m pytest
cd frontend
npm run build
```

## Notas beta

- La API requiere token Bearer salvo endpoints de login, salud, documentacion y archivos en `/uploads`.
- El login devuelve el token y el frontend lo guarda junto con la sesion operativa.
- Los campos de usuario actor del payload deben coincidir con el usuario autenticado.
- No versionar `.env`, `.env.test`, `frontend/node_modules`, `frontend/dist` ni `uploads`.
