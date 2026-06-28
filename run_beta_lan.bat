@echo off
setlocal

cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo Falta el entorno Python en venv.
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo Falta compilar el frontend.
    echo Ejecuta: cd frontend ^&^& npm ci ^&^& npm run build
    exit /b 1
)

echo =========================
echo Iniciando backend beta
echo =========================
start "Backend Beta" cmd /k "cd /d %~dp0 && venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 >nul

echo =========================
echo Iniciando frontend beta
echo =========================
start "Frontend Beta" cmd /k "cd /d %~dp0 && node scripts\serve_frontend.mjs"

echo =========================
echo Sistema iniciado
echo En esta PC: http://localhost:5173
echo En la red:  http://IP_DEL_SERVIDOR:5173
echo API:        http://IP_DEL_SERVIDOR:8000
echo =========================
echo Usa ipconfig para consultar la IP del servidor.
