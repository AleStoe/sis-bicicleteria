@echo off

echo =========================
echo Iniciando Backend
echo =========================

start cmd /k "cd /d %~dp0 && venv\Scripts\activate && uvicorn app.main:app --reload"

timeout /t 2 >nul

echo =========================
echo Iniciando Frontend
echo =========================

start cmd /k "cd /d %~dp0frontend && npm run dev"

echo =========================
echo Sistema iniciado
echo =========================