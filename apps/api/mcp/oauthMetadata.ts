// ---------------------------------------------------------------------------
// Descubrimiento OAuth del servidor MCP: lo primero que consulta un agente
// (Claude) al recibir 401. Funciones puras con las direcciones públicas.
//
//   recurso protegido (RFC 9728)        qué servidor de autorización usar
//   servidor de autorización (RFC 8414) dónde registrarse, autorizar y pedir tokens
//
// La autorización es una PÁGINA de la web (el usuario entra con su sesión y
// elige permisos); el registro y los tokens son de la API.
// ---------------------------------------------------------------------------

export interface OAuthAddresses {
  /** El origen de la web (emisor y pantalla de autorización): `https://auream-os.vercel.app`. */
  readonly issuer: string;
  /** La dirección pública de la API: `https://auream-os.vercel.app/api`. */
  readonly apiBaseUrl: string;
  /** El servidor MCP: `https://auream-os.vercel.app/api/mcp`. */
  readonly resource: string;
}

export const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";
export const AUTHORIZATION_SERVER_PATH = "/.well-known/oauth-authorization-server";
export const OAUTH_REGISTER_PATH = "/oauth/register";
export const OAUTH_TOKEN_PATH = "/oauth/token";

/** Dónde publica el recurso sus metadatos (RFC 9728 §3.1): el origen + la ruta well-known + la ruta del recurso. */
export function resourceMetadataUrlOf(resource: string): string {
  const url = new URL(resource);
  return `${url.origin}${PROTECTED_RESOURCE_PATH}${url.pathname === "/" ? "" : url.pathname}`;
}

export function protectedResourceMetadata(addresses: OAuthAddresses): Record<string, unknown> {
  return {
    resource: addresses.resource,
    authorization_servers: [addresses.issuer],
    bearer_methods_supported: ["header"],
    resource_name: "Auream"
  };
}

export function authorizationServerMetadata(addresses: OAuthAddresses): Record<string, unknown> {
  return {
    issuer: addresses.issuer,
    authorization_endpoint: `${addresses.issuer}/oauth/authorize`,
    token_endpoint: `${addresses.apiBaseUrl}${OAUTH_TOKEN_PATH}`,
    registration_endpoint: `${addresses.apiBaseUrl}${OAUTH_REGISTER_PATH}`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"]
  };
}
