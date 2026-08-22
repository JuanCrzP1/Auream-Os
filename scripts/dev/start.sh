#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SELF_TEST=""

# ---------------------------------------------------------------------------
# DEVELOPMENT ONLY — reemplazar con un secreto seguro en producción
# Generar uno seguro: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ---------------------------------------------------------------------------
export JWT_SECRET="${JWT_SECRET:-dev-only-secret-do-not-use-in-production-32c}"

if [[ "${1:-}" == "--self-test" ]]; then
  SELF_TEST="1"
fi

cd "$ROOT"

echo "========================================"
echo "  Bots Flows"
echo "========================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no está instalado o no está en PATH."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm no está disponible en PATH."
  exit 1
fi

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "[1/5] Instalando dependencias del backend..."
  npm install
else
  echo "[1/5] Dependencias del backend listas."
fi

if [[ ! -d "$ROOT/apps/web/node_modules" ]]; then
  echo "[2/5] Instalando dependencias del builder visual..."
  npm --prefix apps/web install
else
  echo "[2/5] Dependencias del builder visual listas."
fi

echo "[3/5] Validando TypeScript del backend..."
npm run check

echo "[4/5] Compilando backend..."
npm run build

echo "[5/5] Compilando builder visual..."
npm run build:web

if [[ -n "$SELF_TEST" ]]; then
  echo
  echo "Self-test completado correctamente."
  exit 0
fi

mkdir -p "$ROOT/.runtime"

API_LOG="$ROOT/.runtime/api.log"
BUILDER_LOG="$ROOT/.runtime/builder.log"

echo
echo "Iniciando API del builder en segundo plano..."
nohup npm run start:api >"$API_LOG" 2>&1 &
API_PID=$!

echo "Iniciando builder visual en segundo plano..."
nohup npm run dev:web >"$BUILDER_LOG" 2>&1 &
BUILDER_PID=$!

echo "Espera unos segundos para que la API y Vite levanten completamente."

if command -v open >/dev/null 2>&1; then
  echo "Abriendo navegador en http://localhost:5173 ..."
  open "http://localhost:5173" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  echo "Abriendo navegador en http://localhost:5173 ..."
  xdg-open "http://localhost:5173" >/dev/null 2>&1 || true
else
  echo "No se encontró un comando para abrir el navegador automáticamente."
fi

echo
echo "Entorno de desarrollo listo."
echo "- La API del builder queda en http://localhost:3100."
echo "- El builder visual queda en http://localhost:5173."
echo "- Log API: $API_LOG"
echo "- Log Builder: $BUILDER_LOG"
echo "- PID API: $API_PID"
echo "- PID Builder: $BUILDER_PID"