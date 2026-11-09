// ---------------------------------------------------------------------------
// Agentes de IA por MCP — contrato compartido por la API y la web.
//
// Una CREDENCIAL deja que un agente externo (Claude, n8n, Cursor…) use el
// servidor MCP de Auream con permisos POR ÁREA (Leona no los tiene: cada
// credencial puede todo). El token se muestra una sola vez; se guarda su
// huella (no se puede volver a leer) y una pista para reconocerlo.
// ---------------------------------------------------------------------------

/** Qué puede una credencial en un área. */
export type McpAccessLevel = "none" | "read" | "write";

export type McpAreaId = "flows" | "contacts" | "conversations" | "connections";

export interface McpAreaDefinition {
  readonly id: McpAreaId;
  readonly label: string;
  readonly read: string;
  /** Ausente: el área solo se puede ver. */
  readonly write?: string;
}

/** Las áreas y lo que cada nivel deja hacer (las ve quien crea la credencial). */
export const MCP_AREAS: ReadonlyArray<McpAreaDefinition> = [
  { id: "flows", label: "Flujos", read: "Ver tus flujos y sus bloques." },
  { id: "contacts", label: "Contactos y etiquetas", read: "Ver contactos, sus datos y etiquetas.", write: "Crear y editar contactos y ponerles o quitarles etiquetas." },
  { id: "conversations", label: "Conversaciones", read: "Ver los chats y sus mensajes.", write: "Responder como asesor y enviar flujos a un chat." },
  { id: "connections", label: "Números de WhatsApp", read: "Ver tus números y si están conectados." }
];

export type McpPermissions = Readonly<Partial<Record<McpAreaId, McpAccessLevel>>>;

/** Vencimientos que se ofrecen (días); `null`: no vence. */
export const MCP_EXPIRY_OPTIONS: ReadonlyArray<number | null> = [30, 90, 365, null];

export const MCP_TOKEN_PREFIX = "aur_mcp_";

export interface McpCredentialSummary {
  readonly id: string;
  readonly name: string;
  readonly permissions: McpPermissions;
  /** Últimos caracteres del token: `••••3f9a`. */
  readonly hint: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
}

/** Al crear: la credencial y su token, que no se vuelve a mostrar. */
export interface McpCredentialCreated {
  readonly credential: McpCredentialSummary;
  readonly token: string;
}

export interface CreateMcpCredentialRequest {
  readonly name: string;
  readonly permissions: McpPermissions;
  /** Días hasta que vence; `null` u omitido: no vence. */
  readonly expiresInDays?: number | null;
}

export interface McpServerInfo {
  /** La dirección del servidor MCP (para pegar en el agente). */
  readonly url: string;
}
