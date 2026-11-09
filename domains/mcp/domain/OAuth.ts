import { createHash, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// OAuth 2.1 para el servidor MCP (lo que exigen Claude en la web y en la app
// de escritorio): registro dinámico del cliente (RFC 7591), código de
// autorización con PKCE S256 obligatorio y tokens que rotan. Reglas puras.
//
// Lo que el usuario autoriza es una CREDENCIAL MCP de tipo «oauth» con los
// permisos por área que eligió; los tokens son de esa credencial (revocarla
// los corta todos).
// ---------------------------------------------------------------------------

export const OAUTH_TTL = {
  /** El código de autorización: un solo uso y poco tiempo. */
  codeMs: 10 * 60_000,
  accessMs: 60 * 60_000,
  refreshMs: 30 * 86_400_000
} as const;

export const ACCESS_TOKEN_PREFIX = "aur_at_";
export const REFRESH_TOKEN_PREFIX = "aur_rt_";
const MAX_REDIRECT_URIS = 5;

/** Error de OAuth con su código estándar (`invalid_request`, `invalid_grant`…). */
export class OAuthError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    /** ¿Se puede devolver a la `redirect_uri` del cliente? (no si ella misma no es válida). */
    public readonly redirectable = false
  ) {
    super(message);
  }
}

export interface OAuthClient {
  readonly clientId: string;
  readonly name: string;
  readonly redirectUris: ReadonlyArray<string>;
  readonly createdAt: string;
}

/** Lo que pide el agente en `/oauth/authorize`, ya validado. */
export interface AuthorizationRequest {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly state: string | null;
  readonly resource: string | null;
}

/** Un código de autorización emitido (se guarda su huella; se usa una vez). */
export interface OAuthCode {
  readonly codeHash: string;
  readonly clientId: string;
  readonly credentialId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
  readonly resource: string | null;
  readonly expiresAt: string;
}

/** Los tokens vigentes de una autorización: el de acceso (1 h) y el de renovación (30 días, rota en cada uso). */
export interface OAuthTokenSet {
  readonly id: string;
  readonly credentialId: string;
  readonly clientId: string;
  readonly accessHash: string;
  readonly accessExpiresAt: string;
  readonly refreshHash: string;
  readonly refreshExpiresAt: string;
}

/** https en cualquier dominio; http solo en el propio equipo (clientes locales); sin fragmento. */
export function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Metadatos de un registro dinámico de cliente (RFC 7591), validados. */
export function readClientRegistration(raw: unknown): { readonly name: string; readonly redirectUris: string[] } {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const uris = Array.isArray(value["redirect_uris"]) ? value["redirect_uris"].filter((uri): uri is string => typeof uri === "string") : [];
  if (uris.length === 0 || uris.length > MAX_REDIRECT_URIS) throw new OAuthError("invalid_redirect_uri", `Envía entre 1 y ${MAX_REDIRECT_URIS} redirect_uris.`);
  const invalid = uris.find((uri) => !isAllowedRedirectUri(uri));
  if (invalid) throw new OAuthError("invalid_redirect_uri", `redirect_uri no permitida: ${invalid.slice(0, 200)}`);
  const method = value["token_endpoint_auth_method"];
  if (method !== undefined && method !== "none") throw new OAuthError("invalid_client_metadata", "Solo se admiten clientes públicos (token_endpoint_auth_method: none) con PKCE.");
  const name = typeof value["client_name"] === "string" && value["client_name"].trim() ? value["client_name"].trim().slice(0, 80) : "Agente MCP";
  return { name, redirectUris: uris };
}

/**
 * Valida la solicitud de autorización contra el cliente registrado. La
 * `redirect_uri` debe ser EXACTAMENTE una de las registradas: si no, el error
 * no se devuelve a ella (se muestra en Auream).
 */
export function readAuthorizationRequest(params: Readonly<Record<string, string | undefined>>, client: OAuthClient | null, resourceUrl: string): AuthorizationRequest {
  if (!client) throw new OAuthError("invalid_client", "El agente no está registrado. Vuelve a conectarlo desde su programa.");
  const redirectUri = params["redirect_uri"] ?? "";
  if (!client.redirectUris.includes(redirectUri)) throw new OAuthError("invalid_request", "La dirección de regreso no es la que registró el agente.");
  if (params["response_type"] !== "code") throw new OAuthError("unsupported_response_type", "Solo se admite response_type=code.", true);
  if (!params["code_challenge"] || params["code_challenge_method"] !== "S256") throw new OAuthError("invalid_request", "Falta PKCE (code_challenge con S256).", true);
  const resource = params["resource"] || null;
  if (resource && resource.replace(/\/+$/, "") !== resourceUrl) throw new OAuthError("invalid_target", "Ese recurso no es el servidor MCP de Auream.", true);
  return { clientId: client.clientId, redirectUri, codeChallenge: params["code_challenge"], state: params["state"] ?? null, resource };
}

/** PKCE S256: base64url(SHA-256(verifier)) === challenge, comparado en tiempo constante. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

/** La dirección de regreso con sus parámetros (código o error, y el `state` del agente). */
export function redirectWith(redirectUri: string, params: Readonly<Record<string, string | null>>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) if (value !== null) url.searchParams.set(key, value);
  return url.toString();
}
