@echo off

echo =========================
echo Iniciando Backend LAN
echo =========================

start cmd /k "cd /d %~dp0 && venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 >nul

echo =========================
echo Iniciando Frontend LAN
echo =========================

start cmd /k "cd /d %~dp0frontend && npm run dev -- --host 0.0.0.0"

echo =========================
echo Sistema iniciado LAN
echo Backend:  http://192.168.0.66:8000
echo Frontend: http://192.168.0.66:5173
echo =========================