@echo off
setlocal

set "APP_HOST=sistema-agus"
set "API_URL=http://%APP_HOST%:8000"

echo =========================
echo Iniciando Backend
echo =========================

start cmd /k "cd /d %~dp0 && venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 >nul

echo =========================
echo Iniciando Frontend en http://%APP_HOST%
echo =========================

start cmd /k "cd /d %~dp0frontend && set VITE_API_BASE_URL=%API_URL%&& npm run dev -- --host 0.0.0.0 --port 80"

echo =========================
echo Sistema iniciado
echo Frontend: http://%APP_HOST%
echo Backend:  %API_URL%
echo =========================
echo Si no abre, agregá en hosts: IP_DEL_SERVIDOR %APP_HOST%
echo.
