@echo off
setlocal
title Sistema Agus

cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Falta el entorno Python en venv.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] No se encontro frontend\package.json.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERROR] Falta el archivo .env del backend.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [ERROR] Faltan dependencias del frontend.
    echo Ejecuta: cd frontend ^&^& npm install
    pause
    exit /b 1
)

set "LAN_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$addresses=[System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()); foreach($address in $addresses){ if($address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not $address.IPAddressToString.StartsWith('127.') -and -not $address.IPAddressToString.StartsWith('169.254.')){ $address.IPAddressToString; break } }"`) do set "LAN_IP=%%I"

if not defined LAN_IP (
    set "LAN_IP=localhost"
    echo [AVISO] No se detecto una IP de red. Se usara localhost.
)

set "API_URL=http://%LAN_IP%:8000"

echo ========================================
echo Iniciando backend...
echo ========================================
start "Backend Sistema Agus" cmd /k "cd /d ""%~dp0"" && venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

set "BACKEND_OK="
for /l %%N in (1,1,30) do (
    curl.exe --noproxy "*" --silent --fail --max-time 1 http://127.0.0.1:8000/health >nul 2>&1 && (
        set "BACKEND_OK=1"
        goto backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if not defined BACKEND_OK (
    echo [ERROR] El backend no respondio en http://localhost:8000/health
    echo Revisa la ventana "Backend Sistema Agus".
    pause
    exit /b 1
)

echo Backend listo.
echo.
echo ========================================
echo Iniciando frontend...
echo ========================================
start "Frontend Sistema Agus" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"

set "FRONTEND_OK="
for /l %%N in (1,1,40) do (
    curl.exe --noproxy "*" --silent --fail --max-time 1 http://127.0.0.1:5173 >nul 2>&1 && (
        set "FRONTEND_OK=1"
        goto frontend_ready
    )
    timeout /t 1 /nobreak >nul
)

:frontend_ready
if not defined FRONTEND_OK (
    echo [ERROR] El frontend no respondio en http://localhost:5173
    echo Revisa la ventana "Frontend Sistema Agus".
    pause
    exit /b 1
)

echo.
echo ========================================
echo SISTEMA AGUS INICIADO
echo ========================================
echo En esta PC:  http://localhost:5173
echo En la red:   http://%LAN_IP%:5173
echo Backend:     %API_URL%
echo ========================================
echo.
echo Para detener el sistema, cerra las ventanas Backend y Frontend.
pause
