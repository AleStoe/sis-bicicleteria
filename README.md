# Sistema Bicicletería Agus

Sistema local para ventas, pagos, caja, clientes, taller, stock, reservas,
cotizaciones y documentos. Backend FastAPI, PostgreSQL y frontend React/Vite.

## Requisitos

- Windows 10/11
- Python 3.13
- Node.js 20 o superior
- PostgreSQL con `psql`, `pg_dump`, `pg_restore` y `createdb`

Los scripts buscan las herramientas PostgreSQL tanto en `PATH` como en
`C:\Program Files\PostgreSQL\<version>\bin`.

## Configuración inicial

Crear el entorno Python e instalar dependencias:

```powershell
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
```

Instalar frontend:

```powershell
cd frontend
npm ci
cd ..
```

Copiar `.env.example` a `.env` y completar PostgreSQL:

```powershell
Copy-Item .env.example .env
```

Para ejecutar pruebas, crear un `.env.test` local con una base dedicada cuyo
nombre incluya `test`. Este archivo está ignorado por Git y nunca debe apuntar
a la base beta:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bicicleteria_test
DB_USER=postgres
DB_PASSWORD=contraseña-local-de-pruebas
APP_AUTH_DISABLED=true
```

Generar un `APP_SECRET` privado de al menos 32 bytes:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Guardar el resultado en `APP_SECRET`. No reutilizar ejemplos, no versionar
`.env` y no compartirlo por WhatsApp. Cambiar el secreto invalida sesiones
abiertas.

Para beta:

```env
APP_AUTH_DISABLED=false
APP_AUTH_TOKEN_MINUTES=720
```

## Base nueva desde cero

`database_schema.sql` es un snapshot sólo-esquema. No contiene clientes,
ventas, pagos, stock ni contraseñas.

1. Definir en `.env` el nombre de la base nueva.
2. Crear la base.
3. Aplicar esquema y datos técnicos mínimos.
4. Crear el primer administrador.

```powershell
$pgBin = "C:\Program Files\PostgreSQL\18\bin"

& "$pgBin\createdb.exe" -U postgres bicicleteria_beta
& "$pgBin\psql.exe" -U postgres -d bicicleteria_beta -v ON_ERROR_STOP=1 -f database_schema.sql
& "$pgBin\psql.exe" -U postgres -d bicicleteria_beta -v ON_ERROR_STOP=1 -f database\seed_minimo_beta.sql

venv\Scripts\python.exe scripts\create_initial_admin.py --username ale --name "ALE ADMIN"
```

El seed agrega únicamente:

- roles y permisos
- relación rol/permisos
- sucursal `LOCAL PRINCIPAL`
- configuración del negocio
- cliente técnico `CONSUMIDOR FINAL`

La contraseña del administrador se solicita de forma oculta y no queda en
archivos.

## Migraciones

Las instalaciones existentes usan `schema_migrations`:

```powershell
.\scripts\backup_beta.ps1
.\scripts\apply_migrations.ps1
```

Una base antigua que ya contiene el sistema pero no tiene historial debe
verificarse primero. Luego se inicializa una sola vez:

```powershell
.\scripts\apply_migrations.ps1 -BaselineExisting
```

No usar `-BaselineExisting` para saltear migraciones pendientes. El
`database_schema.sql` actual ya incluye como baseline todas las migraciones
versionadas hasta `20260628_01_drop_pagos_reversion_legacy.sql`.

## Arranque diario de la beta

El sistema usa un único punto de entrada:

```powershell
.\run_sistema_agus.bat
```

El script:

- detecta automáticamente la IP del servidor
- inicia Uvicorn en `0.0.0.0:8000`
- espera hasta que el backend responda
- inicia Vite en `0.0.0.0:5173`
- muestra las direcciones para esta PC y para la red local

Consultar la IP con `ipconfig`. Conviene reservar la IP del servidor en el
router y habilitar en Firewall de Windows los puertos TCP `5173` y `8000`
sólo para red privada.

No crear `frontend/.env.local` con una IP fija. El frontend obtiene el host
desde la dirección abierta en el navegador: localhost en el servidor y la IP
local en los demás equipos. Así ninguna dirección anterior queda incrustada.

Durante la beta se usa Vite para simplificar la operación diaria. El frontend
compilado se evaluará al preparar la instalación productiva definitiva.

## Backup

### Desde el sistema

El administrador puede abrir `Sistema > Backups` para:

- generar un `.dump` PostgreSQL en formato custom (`pg_dump -F c`)
- generar un `.zip` con `database.dump` y la carpeta `uploads`
- listar y descargar copias existentes

La pantalla no permite restaurar ni eliminar backups. Cada generación y
descarga queda registrada en auditoría. Los archivos quedan en `backups\`,
una carpeta privada que no se expone como contenido estático.

Antes de usar el módulo, aplicar las migraciones pendientes:

```powershell
.\scripts\apply_migrations.ps1
```

### Desde PowerShell

Crear un respaldo completo:

```powershell
.\scripts\backup_beta.ps1
```

Se genera `backups\<base>_<fecha>\` con:

- `database.dump`
- `uploads\`
- `config\.env`
- `manifest.json` con hash SHA-256 y commit Git

La copia contiene configuración sensible. Guardarla en un disco externo o
carpeta privada. No versionar `backups`.

Frecuencia recomendada:

- diario al cerrar el local
- antes de aplicar migraciones
- antes de actualizar código

## Restore

El restore es exclusivamente manual. Nunca sobrescribe una base existente y
siempre exige un nombre nuevo.

Para un `.dump` generado desde la pantalla:

```powershell
.\scripts\restore_beta.ps1 `
  -BackupPath .\backups\backup-emprendimiento-agus-YYYYMMDD-HHMM.dump `
  -TargetDatabase emprendimiento_agus_restore_test
```

Para un `.zip` con uploads, indicar una carpeta destino vacía:

```powershell
.\scripts\restore_beta.ps1 `
  -BackupPath .\backups\backup-emprendimiento-agus-YYYYMMDD-HHMM.zip `
  -TargetDatabase emprendimiento_agus_restore_test `
  -UploadsDirectory .\restore-test-uploads `
  -RestoreUploads
```

El formato anterior por carpeta continúa soportado:

```powershell
.\scripts\restore_beta.ps1 `
  -BackupPath .\backups\bicicleteria_beta_YYYYMMDD_HHMMSS `
  -TargetDatabase bicicleteria_beta_restore_test
```

Para restaurar también `uploads`, la carpeta destino debe estar vacía:

```powershell
.\scripts\restore_beta.ps1 `
  -BackupPath .\backups\bicicleteria_beta_YYYYMMDD_HHMMSS `
  -TargetDatabase bicicleteria_beta_recuperada `
  -RestoreUploads
```

Después:

1. Copiar o revisar `config\.env` del backup.
2. Cambiar `DB_NAME` al nombre restaurado.
3. Iniciar el backend.
4. Probar login, catálogo, una venta de prueba y documentos.

No eliminar la base original hasta validar la restaurada.

## Verificación técnica

```powershell
venv\Scripts\python.exe -m pytest

cd frontend
npm run build
```

Antes de abrir la beta también verificar:

- login con administrador y operador
- apertura/cierre de caja
- venta efectivo, transferencia y tarjeta
- venta con deuda y pago posterior
- OT, consumo de repuesto, facturación y retiro
- inventario físico
- generación de PDF
- backup y restore en una base separada

## Archivos que no se versionan

- `.env`
- `frontend/.env.local`
- `uploads`
- `backups`
- `frontend/dist`
- `frontend/node_modules`
- `venv`

## Seguridad del historial Git

Eliminar un archivo sensible del directorio actual no lo elimina de commits
anteriores. Si una contraseña o script con credenciales llegó a versionarse,
hay que rotar esas credenciales y luego sanear el historial Git antes de
publicar o compartir el repositorio. Reescribir el historial requiere coordinar
un `force push` y que todos los clones vuelvan a sincronizarse.
