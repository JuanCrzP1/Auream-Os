#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Build de Vercel (web + base de datos), en este orden:
//
//   1. Comprueba la configuración del entorno: en PRODUCCIÓN, faltar algo
//      obligatorio o tener credenciales de desarrollo aborta el despliegue
//      (la versión anterior sigue sirviendo).
//   2. Migraciones: producción → rama de producción de Neon (con
//      --confirm-production; `resolveTargetDatabase` comprueba el host).
//      Vistas previas → rama test, solo si hay TEST_DATABASE_URL.
//      Las migraciones son aditivas: la versión que aún sirve sigue funcionando.
//   3. La web (apps/web), apuntando a la API del mismo dominio (`/api`).
//
// La API no se compila aquí: Vercel compila `api/index.ts` como función.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";

const env = process.env;
const target = env.VERCEL_ENV ?? "development";

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...env, ...extraEnv } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(lines) {
  console.error(["", "✖ Despliegue detenido:", ...lines.map((line) => `  - ${line}`), ""].join("\n"));
  process.exit(1);
}

// 1. Configuración ------------------------------------------------------------
if (target === "production") {
  const required = [
    ["DATABASE_URL", "connection string de la rama de PRODUCCIÓN de Neon (la «pooled»)"],
    ["NEON_AUTH_URL", "URL de Neon Auth de la rama de producción"],
    ["NEON_AUTH_ISSUER", "issuer de Neon Auth de la rama de producción"],
    ["VITE_NEON_AUTH_URL", "la misma URL de Neon Auth, para la web"],
    ["CORS_ALLOWED_ORIGINS", "el dominio de producción, p. ej. https://auream-os.vercel.app"],
    ["CREDENTIALS_ENCRYPTION_KEY", "clave maestra de cifrado (openssl rand -base64 32)"],
    ["BLOB_READ_WRITE_TOKEN", "almacén de archivos: Vercel → Storage → Blob → conectar al proyecto (lo crea Vercel)"]
  ];
  const missing = required.filter(([name]) => !env[name]).map(([name, what]) => `falta ${name}: ${what}`);
  const forbidden = ["DEV_API_KEY", "VITE_DEV_API_KEY", "INTEGRATIONS_ALLOW_PRIVATE_NETWORK"]
    .filter((name) => env[name])
    .map((name) => `${name} es solo de desarrollo: quítala del entorno Production de Vercel`);
  if (missing.length + forbidden.length > 0) fail([...missing, ...forbidden]);
}

// 2. Migraciones --------------------------------------------------------------
if (target === "production") {
  console.log("→ Migraciones: rama de producción");
  run("node", ["scripts/db/migrate.mjs", "--confirm-production"]);
} else if (env.TEST_DATABASE_URL) {
  console.log("→ Migraciones: rama test");
  run("node", ["scripts/db/migrate.mjs"]);
} else {
  console.log("→ Migraciones: omitidas (sin TEST_DATABASE_URL en este entorno)");
}

// 3. Web ----------------------------------------------------------------------
// En producción, la dirección oficial (el dominio de producción del proyecto,
// que Vercel expone al build): la web lleva ahí a quien entre por otra.
const appUrl = target === "production" && env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
console.log(`→ Web${appUrl ? ` (dirección oficial: ${appUrl})` : ""}`);
run("npm", ["--prefix", "apps/web", "run", "build"], {
  VITE_API_BASE_URL: env.VITE_API_BASE_URL || "/api",
  ...(appUrl ? { VITE_APP_URL: appUrl } : {})
});
