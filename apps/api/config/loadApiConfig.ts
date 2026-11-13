import { ApiConfigError } from "./ApiConfigError";
import { loadWhatsAppSimulator } from "./loadWhatsAppSimulator";
import { loadTasksConfig, productionHostOf, type TasksConfig } from "./loadTasksConfig";
import { join } from "node:path";
import { readSecretKeyRing, type SecretKeyRing } from "../../../platform/security/secrets/AesGcmSecretCipher";

// ---------------------------------------------------------------------------
// loadApiConfig
//
// Responsabilidad única: leer y validar la configuración de entorno de la API.
//
// Falla de forma segura: si falta algo obligatorio, o si una credencial de
// desarrollo aparece en producción, el proceso no arranca.
//
// La identidad de usuario la emite y firma Neon Auth (ver loadNeonAuthConfig);
// esta API ya no firma tokens, así que no necesita ningún secreto propio.
// ---------------------------------------------------------------------------

/** Debe coincidir con el prefijo que exige `platform/identity/ApiKeyVerifier`. */
const API_KEY_PREFIX = "bfk_";
const DEFAULT_PORT = 3100;

/**
 * Origen canónico de desarrollo. UNO solo, y es `localhost`.
 *
 * No se incluye `http://127.0.0.1:5173` aunque apunte a la misma máquina:
 * Neon Auth confía en `localhost` pero rechaza `127.0.0.1` con
 * `INVALID_ORIGIN` (verificado contra la rama `test`). Aceptarlo aquí daría
 * una falsa sensación de soporte — la API respondería, pero el usuario no
 * podría iniciar sesión, que es el fallo más confuso posible.
 */
const DEFAULT_DEV_ORIGINS = ["http://localhost:5173"];

export interface ApiConfig {
  readonly port: number;
  readonly isProduction: boolean;
  readonly allowedOrigins: readonly string[];
  /** API key de desarrollo. Siempre null en producción. */
  readonly devApiKey: string | null;
  readonly devTenantId: string;
  readonly dataDirectory: string;
  /**
   * Dónde se guardan las automatizaciones: `sql` (PostgreSQL) o `json`
   * (archivos en `dataDirectory`, solo desarrollo). En producción siempre `sql`.
   */
  readonly automationsStore: AutomationsStore;
  /**
   * Zona horaria IANA con la que se ejecutan los flujos mientras las cuentas
   * no tengan la suya propia (ajustes de cuenta). `DEFAULT_TENANT_TIMEZONE`.
   */
  readonly defaultTimezone: string;
  /**
   * Permite que las integraciones lleguen a la red privada (localhost, LAN).
   * Solo desarrollo, para probar contra servicios locales:
   * `INTEGRATIONS_ALLOW_PRIVATE_NETWORK=true`. Prohibido en producción.
   */
  readonly integrationsAllowPrivateNetwork: boolean;
  /**
   * Claves maestras con las que se cifran los secretos de los clientes
   * (conexiones de IA). `CREDENTIALS_ENCRYPTION_KEY`, obligatoria en
   * producción. Sin ella, en desarrollo, las conexiones de IA no están
   * disponibles.
   */
  readonly credentialsKeyRing: SecretKeyRing | null;
  /**
   * Medios (imágenes, videos…): con `BLOB_READ_WRITE_TOKEN` van a Vercel Blob
   * (producción y vistas previas; Vercel lo crea al conectar el almacén). Sin
   * él, en desarrollo, a una carpeta local servida por la API.
   */
  readonly blobReadWriteToken: string | null;
  /** Dirección pública de la API para las URLs de los medios locales (desarrollo). */
  readonly publicApiBaseUrl: string;
  /** Origen público de la web (emisor OAuth): `PUBLIC_APP_URL`, el dominio de producción o el primer origen permitido. */
  readonly publicAppOrigin: string;
  /** Versión de la Graph API de Meta para el Pixel (`META_GRAPH_API_VERSION`, p. ej. `v23.0`). */
  readonly metaGraphVersion: string;
  /**
   * La app de Meta (`META_APP_ID` + `META_APP_SECRET`): firma la vuelta del
   * inicio de sesión y verifica los avisos de borrado de datos de Meta.
   * `META_LOGIN_CONFIG_ID` (la configuración del inicio de sesión para
   * empresas) es lo que enciende «Conectar con Meta»: ponerla en producción
   * SOLO cuando Meta apruebe el acceso avanzado. `null`: sin app.
   */
  readonly metaApp: { readonly appId: string; readonly appSecret: string; readonly loginConfigId?: string } | null;
  /** Adonde vuelve el inicio de sesión de Meta (`META_OAUTH_REDIRECT_URL`; por defecto `<dominio>/api/ads/meta/callback`). */
  readonly metaOAuthRedirectUrl: string;
  /** Delante del enlace de cada campaña de grupos (`<base>/<slug>`): el dominio de la app en producción. */
  readonly groupLinkBase: string;
  /** Dirección pública de los artículos en Markdown (`<base>/<slug>.md`), para `llms.txt`. */
  readonly helpDocsBase: string;
  /**
   * Proveedor de WhatsApp por código QR (`UAZAPI_BASE_URL` + `UAZAPI_ADMIN_TOKEN`).
   * `null`: las conexiones por QR se crean, pero vincular dice que falta el proveedor.
   */
  readonly uazapi: { readonly baseUrl: string; readonly adminToken: string } | null;
  /** WhatsApp simulado en vez de uazapi (`WHATSAPP_SIMULATOR_URL`, solo desarrollo). */
  readonly whatsappSimulator: boolean;
  /**
   * Dirección pública de la API donde el proveedor avisa los cambios de
   * conexión (`WHATSAPP_WEBHOOK_BASE_URL`; en Vercel producción, la oficial).
   * `null` en desarrollo: la pantalla consulta el estado por su cuenta.
   */
  readonly whatsappWebhookBaseUrl: string | null;
  /** Cola de tareas (FASE C6): ver `loadTasksConfig`. */
  readonly tasks: TasksConfig;
}

/** ¿Es una zona IANA que el motor sabe usar? */
function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export type AutomationsStore = "json" | "sql";

// La clase vive aparte para que los lectores de configuración la usen sin ciclos de importación.
export { ApiConfigError } from "./ApiConfigError";

/** «a, b,,c» → ["a", "b", "c"]. */
const readOrigins = (raw: string | undefined): string[] => (raw ?? "").split(",").map((origin) => origin.trim()).filter((origin) => origin.length > 0);

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const isProduction = env["NODE_ENV"] === "production";

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
  const store = env["AUTOMATIONS_STORE"] ?? (isProduction ? "sql" : "json");
  if (store !== "json" && store !== "sql") {
    throw new ApiConfigError(`AUTOMATIONS_STORE debe ser "sql" o "json" (llegó "${store}").`);
  }
  const defaultTimezone = env["DEFAULT_TENANT_TIMEZONE"] ?? "America/Bogota";
  if (!isValidTimezone(defaultTimezone)) {
    throw new ApiConfigError(`DEFAULT_TENANT_TIMEZONE no es una zona horaria válida: "${defaultTimezone}".`);
  }
  const integrationsAllowPrivateNetwork = env["INTEGRATIONS_ALLOW_PRIVATE_NETWORK"] === "true";
  if (isProduction && integrationsAllowPrivateNetwork) {
    throw new ApiConfigError("INTEGRATIONS_ALLOW_PRIVATE_NETWORK no se puede activar en producción: abriría la red interna a las integraciones.");
  }
  const credentialsKeyRing = readSecretKeyRing(env);
  if (isProduction && !credentialsKeyRing) {
    throw new ApiConfigError("CREDENTIALS_ENCRYPTION_KEY es obligatoria en producción: cifra las claves de IA de los clientes.");
  }
  for (const [version, key] of Object.entries(credentialsKeyRing?.keys ?? {})) {
    if (key.length !== 32) {
      throw new ApiConfigError(`La clave maestra «${version}» debe ser base64 de 32 bytes (genera una con: openssl rand -base64 32).`);
    }
  }
  const metaGraphVersion = env["META_GRAPH_API_VERSION"]?.trim() || "v23.0";
  if (!/^v\d+\.\d+$/.test(metaGraphVersion)) {
    throw new ApiConfigError(`META_GRAPH_API_VERSION debe tener la forma v23.0 (llegó "${metaGraphVersion}").`);
  }
  const uazapiUrl = env["UAZAPI_BASE_URL"]?.trim().replace(/\/+$/, "") || "";
  const uazapiToken = env["UAZAPI_ADMIN_TOKEN"]?.trim() || "";
  if (Boolean(uazapiUrl) !== Boolean(uazapiToken)) {
    throw new ApiConfigError("Para conectar WhatsApp por QR hacen falta UAZAPI_BASE_URL y UAZAPI_ADMIN_TOKEN juntos.");
  }
  if (uazapiUrl && !/^https:\/\/[^\s/]+$/.test(uazapiUrl)) {
    throw new ApiConfigError(`UAZAPI_BASE_URL debe ser la dirección https de tu servidor de uazapi, p. ej. https://tunegocio.uazapi.com (llegó "${uazapiUrl}").`);
  }
  if ((uazapiUrl || env["WHATSAPP_SIMULATOR_URL"]?.trim()) && !credentialsKeyRing) {
    throw new ApiConfigError("Conectar WhatsApp por QR necesita CREDENTIALS_ENCRYPTION_KEY: el token de cada número se guarda cifrado.");
  }
  const productionHost = productionHostOf(env);
  const simulator = loadWhatsAppSimulator(env, isProduction);
  const localApiBaseUrl = env["PUBLIC_API_BASE_URL"]?.trim() || `http://localhost:${Number(env["PORT"] ?? DEFAULT_PORT)}`;
  // Con el simulador, los avisos vuelven a esta API local.
  const whatsappWebhookBaseUrl =
    env["WHATSAPP_WEBHOOK_BASE_URL"]?.trim().replace(/\/+$/, "") || (productionHost ? `https://${productionHost}/api` : simulator ? localApiBaseUrl : null);
  if (isProduction && store !== "sql") {
    throw new ApiConfigError("En producción las automatizaciones se guardan en PostgreSQL: AUTOMATIONS_STORE debe ser \"sql\".");
  }

  return {
    port: Number(env["PORT"] ?? DEFAULT_PORT),
    isProduction,
    allowedOrigins,
    devApiKey: isProduction ? null : devApiKey,
    devTenantId: env["DEV_TENANT_ID"] ?? "test-tenant",
    dataDirectory: env["DATA_DIR"] ?? join(process.cwd(), "data", "builder-workspaces"),
    automationsStore: store,
    defaultTimezone,
    integrationsAllowPrivateNetwork,
    credentialsKeyRing,
    blobReadWriteToken: env["BLOB_READ_WRITE_TOKEN"]?.trim() || null,
    publicApiBaseUrl: env["PUBLIC_API_BASE_URL"]?.trim() || `http://localhost:${Number(env["PORT"] ?? DEFAULT_PORT)}`,
    publicAppOrigin: env["PUBLIC_APP_URL"]?.trim().replace(/\/+$/, "") || (productionHost ? `https://${productionHost}` : (allowedOrigins[0] ?? "http://localhost:5173")),
    metaGraphVersion,
    metaApp: metaAppOf(env),
    metaOAuthRedirectUrl:
      env["META_OAUTH_REDIRECT_URL"]?.trim() ||
      (productionHost ? `https://${productionHost}/api/ads/meta/callback` : `${env["PUBLIC_API_BASE_URL"]?.trim() || `http://localhost:${Number(env["PORT"] ?? DEFAULT_PORT)}`}/ads/meta/callback`),
    uazapi: simulator ?? (uazapiUrl ? { baseUrl: uazapiUrl, adminToken: uazapiToken } : null),
    whatsappSimulator: simulator !== null,
    whatsappWebhookBaseUrl,
    groupLinkBase: productionHost ? `https://${productionHost}/g` : `${env["PUBLIC_API_BASE_URL"]?.trim() || `http://localhost:${Number(env["PORT"] ?? DEFAULT_PORT)}`}/g`,
    helpDocsBase: productionHost ? `https://${productionHost}/api/help/docs` : `${env["PUBLIC_API_BASE_URL"]?.trim() || `http://localhost:${Number(env["PORT"] ?? DEFAULT_PORT)}`}/help/docs`,
    tasks: loadTasksConfig(env, productionHost)
  };
}

/** La app de Meta (id, secreto y, si hay, la configuración del inicio de sesión para empresas). */
function metaAppOf(env: NodeJS.ProcessEnv): ApiConfig["metaApp"] {
  const appId = env["META_APP_ID"]?.trim();
  const appSecret = env["META_APP_SECRET"]?.trim();
  if (!appId || !appSecret) return null;
  const loginConfigId = env["META_LOGIN_CONFIG_ID"]?.trim();
  if (loginConfigId && !/^\d{5,30}$/.test(loginConfigId)) throw new ApiConfigError("META_LOGIN_CONFIG_ID debe ser el número de la configuración de Meta.");
  return { appId, appSecret, ...(loginConfigId ? { loginConfigId } : {}) };
}
