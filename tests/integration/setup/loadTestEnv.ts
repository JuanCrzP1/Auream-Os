import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// loadTestEnv
//
// Responsabilidad única: volcar `.env.test` a `process.env` antes de que las
// barreras de entorno lean nada.
//
// Sin esto, `npm run test:integration` sólo funcionaba si el operador exportaba
// las variables a mano en su shell. Es el equivalente de `apps/api/config/
// loadEnvFile` para la suite de integración: archivo distinto (`.env.test`, no
// `.env`) y variables distintas a propósito, para que un test nunca herede por
// accidente la configuración de producción.
//
// Una variable ya presente en el entorno nunca se sobreescribe: CI siempre
// gana sobre el archivo local.
// ---------------------------------------------------------------------------

/** Raíz del repositorio, tres niveles por encima de este archivo. */
function repositoryRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

export function loadTestEnv(
  env: NodeJS.ProcessEnv = process.env,
  rootDir: string = repositoryRoot()
): void {
  const path = join(rootDir, ".env.test");

  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // Mismo tratamiento de comillas que `apps/api/config/loadEnvFile`: sin él,
    // una connection string entrecomillada llegaría con las comillas dentro y
    // la barrera de entorno la rechazaría como "URL inválida", que es un
    // motivo de aborto engañoso.
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));

    if (quoted) {
      value = value.slice(1, -1);
    }

    if (key.length > 0 && env[key] === undefined) {
      env[key] = value;
    }
  }
}
