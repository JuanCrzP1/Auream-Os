@echo off
setlocal

set "SELF_TEST="

rem ---------------------------------------------------------------------------
rem DEVELOPMENT ONLY — reemplazar con un secreto seguro en produccion
rem Generar uno seguro: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
rem ---------------------------------------------------------------------------
if not defined JWT_SECRET set "JWT_SECRET=dev-only-secret-do-not-use-in-production-32c"

if /i "%~1"=="--self-test" set "SELF_TEST=1"

rem Situarse en la raiz del repositorio (dos niveles arriba de scripts/dev)
cd /d "%~dp0..\.."
if errorlevel 1 goto :failed
set "ROOT=%CD%\"

echo ========================================
echo   Bots Flows
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :missing_node

where npm >nul 2>&1
if errorlevel 1 goto :missing_npm

if not exist "%ROOT%node_modules" (
  echo [1/5] Instalando dependencias del backend...
  call npm install
  if errorlevel 1 goto :failed
) else (
  echo [1/5] Dependencias del backend listas.
)

if not exist "%ROOT%apps\web\node_modules" (
  echo [2/5] Instalando dependencias del builder visual...
  call npm --prefix apps/web install
  if errorlevel 1 goto :failed
) else (
  echo [2/5] Dependencias del builder visual listas.
)

echo [3/5] Validando TypeScript del backend...
call npm run check
if errorlevel 1 goto :failed

echo [4/5] Compilando backend...
call npm run build
if errorlevel 1 goto :failed

echo [5/5] Compilando builder visual...
call npm run build:web
if errorlevel 1 goto :failed

if defined SELF_TEST goto :success

echo.
echo Iniciando API del builder en una nueva ventana...
start "Bots Flows API" cmd /k "cd /d ""%ROOT%"" && npm run start:api"

echo Iniciando builder visual en una nueva ventana...
start "Bots Flows Builder" cmd /k "cd /d ""%ROOT%"" && npm run dev:web"

echo Espera unos segundos para que la API y Vite levanten completamente.

echo Abriendo navegador en http://localhost:5173 ...
start "" "http://localhost:5173"

echo.
echo Entorno de desarrollo listo.
echo - La API del builder queda en http://localhost:3100.
echo - El builder visual queda en http://localhost:5173.
echo - Si cambias el builder, Vite recarga solo.
echo.
pause
exit /b 0

:missing_node
echo ERROR: Node.js no esta instalado o no esta en PATH.
pause
exit /b 1

:missing_npm
echo ERROR: npm no esta disponible en PATH.
pause
exit /b 1

:failed
echo.
echo ERROR: Fallo la preparacion del entorno de desarrollo.
pause
exit /b 1

:success
echo.
echo Self-test completado correctamente.
exit /b 0