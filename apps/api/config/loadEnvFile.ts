import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// loadEnvFile
//
// Responsabilidad única: volcar `.env` a `process.env` antes de que el resto
// de `loadXConfig.ts` lea nada.
//
// Por qué existe: `.env` en la raíz del repo guarda DATABASE_URL, NEON_AUTH_URL,
// etc. (ver .env.example), pero ni Node ni los launchers (start.bat/start.sh)
// lo cargaban — sólo extraían DEV_API_KEY línea a línea. El resultado era que
// `node dist/apps/api/main.js` arrancaba con esas variables vacías y moría con
// "[FATAL] DATABASE_URL no está definido", aunque el archivo tuviera el valor
// correcto. Este loader es el único punto que lo lee, así que da igual cómo se
// arranque el proceso (start.bat, start.sh, IDE, `npm run start:api` a pelo).
//
// Una variable YA presente en process.env nunca se sobreescribe: un entorno
// real (producción, CI) siempre gana sobre lo que diga el archivo.
// ---------------------------------------------------------------------------

function parseEnvFile(contents: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    const isQuoted = value.length >= 2 && (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    );

    if (isQuoted) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      values.set(key, value);
    }
  }

  return values;
}

// __dirname compila a dist/apps/api/config: 4 niveles arriba es la raíz del repo.
export function loadEnvFile(env: NodeJS.ProcessEnv = process.env, rootDir: string = join(__dirname, "..", "..", "..", "..")): void {
  const envPath = join(rootDir, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const parsed = parseEnvFile(readFileSync(envPath, "utf-8"));

  for (const [key, value] of parsed) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}
