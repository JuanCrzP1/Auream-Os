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

export type McpAreaId = "flows" | "contacts" | "conversations" | "quick_replies" | "connections" | "sales" | "crm" | "analytics" | "broadcasts" | "groups";

export interface McpAreaDefinition {
  readonly id: McpAreaId;
  readonly label: string;
  readonly read: string;
  /** Ausente: el área solo se puede ver. */
  readonly write?: string;
}

/** Las áreas y lo que cada nivel deja hacer (las ve quien crea la credencial). */
export const MCP_AREAS: ReadonlyArray<McpAreaDefinition> = [
  {
    id: "flows",
    label: "Flujos",
    read: "Ver tus flujos y sus bloques.",
    write: "Crear flujos y agregar, configurar, conectar o borrar sus bloques. Los cambios quedan activos al instante."
  },
  {
    id: "contacts",
    label: "Contactos y etiquetas",
    read: "Ver contactos, sus datos y etiquetas.",
    write: "Crear y editar contactos, crear etiquetas y ponerlas o quitarlas."
  },
  { id: "conversations", label: "Conversaciones", read: "Ver los chats y sus mensajes.", write: "Responder como asesor (también con respuestas rápidas) y enviar flujos a un chat." },
  {
    id: "quick_replies",
    label: "Respuestas rápidas",
    read: "Ver las respuestas rápidas guardadas.",
    write: "Crear, editar y borrar respuestas rápidas (lo que el equipo usa en los chats)."
  },
  {
    id: "connections",
    label: "Números de WhatsApp",
    read: "Ver tus números, si están conectados y sus disparadores.",
    write: "Crear, editar y quitar disparadores: qué flujo arranca con cada mensaje. No conecta ni desconecta números."
  },
  {
    id: "sales",
    label: "Ventas y productos",
    read: "Ver ventas, sus totales y el catálogo de productos con sus precios.",
    write: "Anotar ventas, corregirlas, aprobarlas o anularlas (con motivo), y crear, editar o archivar productos."
  },
  { id: "crm", label: "CRM", read: "Ver embudos, etapas y en qué etapa va cada cliente.", write: "Mover clientes de etapa y editar sus negocios." },
  { id: "analytics", label: "Dashboard y anuncios", read: "Ver el Dashboard: ventas, ROAS real, gasto en Meta, anuncios y atención." },
  {
    id: "broadcasts",
    label: "Difusiones",
    read: "Ver las difusiones, sus resultados y a quién le llegaron.",
    write: "Calcular a cuántos les llega, crear difusiones (ahora o programadas), pausarlas, seguirlas y cancelarlas. Siempre con envío seguro."
  },
  {
    id: "groups",
    label: "Grupos y comunidades",
    read: "Ver las campañas de grupos, sus grupos y lo que vende cada uno.",
    write: "Crear y editar campañas, encender o apagar su enlace, traer los grupos de WhatsApp, sumar o sacar grupos y enviar a grupos."
  }
];

export type McpPermissions = Readonly<Partial<Record<McpAreaId, McpAccessLevel>>>;

/** Vencimientos que se ofrecen (días); `null`: no vence. */
export const MCP_EXPIRY_OPTIONS: ReadonlyArray<number | null> = [30, 90, 365, null];

export const MCP_TOKEN_PREFIX = "aur_mcp_";

/** `token`: creada a mano (se pega el token); `oauth`: autorizada desde el agente (Claude web y escritorio). */
export type McpCredentialKind = "token" | "oauth";

export interface McpCredentialSummary {
  readonly id: string;
  readonly kind: McpCredentialKind;
  readonly name: string;
  readonly permissions: McpPermissions;
  /** Últimos caracteres del token: `••••3f9a` (vacío en las de OAuth: sus tokens rotan). */
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
