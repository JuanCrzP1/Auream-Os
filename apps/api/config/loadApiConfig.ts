import { join } from "node:path";

// ---------------------------------------------------------------------------
// loadApiConfig
//
// Responsabilidad única: leer y validar la configuración de entorno de la API.
//
// Falla de forma segura: si falta algo obligatorio, o si una credencial de
// desarrollo aparece en producción, el proceso no arranca.
// ---------------------------------------------------------------------------

const MINIMUM_JWT_SECRET_LENGTH = 32;
/** Debe coincidir con el prefijo que exige `platform/identity/ApiKeyVerifier`. */
const API_KEY_PREFIX = "bfk_";
const DEFAULT_PORT = 3100;
const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export interface ApiConfig {
  readonly port: number;
  readonly isProduction: boolean;
  readonly jwtSecret: string;
  readonly allowedOrigins: readonly string[];
  /** API key de desarrollo. Siempre null en producción. */
  readonly devApiKey: string | null;
  readonly devTenantId: string;
  readonly dataDirectory: string;
}

export class ApiConfigError extends Error {}

function readOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const isProduction = env["NODE_ENV"] === "production";

  const jwtSecret = env["JWT_SECRET"];

  if (!jwtSecret) {
    throw new ApiConfigError(
      "JWT_SECRET no está definido. El servidor no puede arrancar sin un secreto de firma."
    );
  }

  if (jwtSecret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new ApiConfigError(
      `JWT_SECRET debe tener al menos ${MINIMUM_JWT_SECRET_LENGTH} caracteres.`
    );
  }

  const devApiKey = env["DEV_API_KEY"] ?? null;

  if (isProduction && devApiKey) {
    throw new ApiConfigError(
      "DEV_API_KEY está definido con NODE_ENV=production. Las credenciales de desarrollo no pueden existir en producción."
    );
  }

  // `ApiKeyVerifier` exige el prefijo del formato. Sin esta comprobación, una
  // clave mal formada se aceptaría al arrancar y fallaría con un 401 opaco en
  // cada petición.
  if (devApiKey && !devApiKey.startsWith(API_KEY_PREFIX)) {
    throw new ApiConfigError(
      `DEV_API_KEY debe empezar por "${API_KEY_PREFIX}" para que el verificador de API keys la acepte.`
    );
  }

  const configuredOrigins = readOrigins(env["CORS_ALLOWED_ORIGINS"]);

  if (isProduction && configuredOrigins.length === 0) {
    throw new ApiConfigError(
      "CORS_ALLOWED_ORIGINS es obligatorio en producción. No se permite un CORS abierto."
    );
  }

  const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_DEV_ORIGINS;

  return {
    port: Number(env["PORT"] ?? DEFAULT_PORT),
    isProduction,
    jwtSecret,
    allowedOrigins,
    devApiKey: isProduction ? null : devApiKey,
    devTenantId: env["DEV_TENANT_ID"] ?? "test-tenant",
    dataDirectory: env["DATA_DIR"] ?? join(process.cwd(), "data", "builder-workspaces")
  };
}
