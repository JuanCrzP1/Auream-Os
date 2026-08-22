#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ensure-dev-key.mjs
//
// Responsabilidad única: garantizar que exista una credencial DEV_API_KEY
// de desarrollo y que backend y frontend usen exactamente el mismo valor.
//
// Se ejecuta desde start.bat y start.sh — es la única lógica de generación
// y no está duplicada en batch/bash: ambos launchers sólo invocan este
// script y leen el resultado desde los ficheros que este script mantiene.
//
// Escribe (crea o actualiza sólo su propia línea, preservando el resto):
//   .env                    DEV_API_KEY=<valor>
//   apps/web/.env.local     VITE_DEV_API_KEY=<valor>
//
// Ambos ficheros están cubiertos por .gitignore (.env / .env.*) — no se
// versionan. Si ya existe un valor válido (empieza por "bfk_"), se reutiliza
// tal cual en los dos ficheros en lugar de generar uno nuevo, de modo que
// backend y frontend nunca queden desincronizados.
//
// Nunca imprime la credencial completa en consola.
// ---------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROOT_ENV_PATH = join(ROOT, ".env");
const WEB_ENV_LOCAL_PATH = join(ROOT, "apps", "web", ".env.local");
const KEY_PREFIX = "bfk_";

function readEnvValue(path, key) {
  if (!existsSync(path)) {
    return null;
  }

  const line = readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));

  return line ? line.slice(key.length + 1).trim() : null;
}

/** Crea o actualiza sólo la línea `KEY=value`; preserva el resto del fichero. */
function upsertEnvLine(path, key, value) {
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  const withoutBlankTail = lines.length > 0 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;

  const index = withoutBlankTail.findIndex((l) => l.startsWith(`${key}=`));
  const newLine = `${key}=${value}`;

  if (index >= 0) {
    withoutBlankTail[index] = newLine;
  } else {
    withoutBlankTail.push(newLine);
  }

  writeFileSync(path, withoutBlankTail.join("\n") + "\n", "utf-8");
}

function generateDevKey() {
  return `${KEY_PREFIX}dev_${randomBytes(12).toString("hex")}`;
}

function mask(value) {
  return `${value.slice(0, 8)}${"*".repeat(Math.max(value.length - 8, 4))}`;
}

function main() {
  // Reutilizar si ya hay una credencial DEV válida en cualquiera de los dos
  // ficheros, para no invalidar tokens que el desarrollador ya esté usando.
  const existing =
    readEnvValue(ROOT_ENV_PATH, "DEV_API_KEY") ??
    readEnvValue(WEB_ENV_LOCAL_PATH, "VITE_DEV_API_KEY");

  const devKey = existing && existing.startsWith(KEY_PREFIX) ? existing : generateDevKey();

  upsertEnvLine(ROOT_ENV_PATH, "DEV_API_KEY", devKey);
  upsertEnvLine(WEB_ENV_LOCAL_PATH, "VITE_DEV_API_KEY", devKey);

  console.log(`Credencial DEV lista: ${mask(devKey)} (backend .env + apps/web/.env.local)`);
}

main();
