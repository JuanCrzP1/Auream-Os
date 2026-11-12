import { createHash } from "node:crypto";
import { MCP_AREAS, type McpAccessLevel, type McpAreaId, type McpCredentialKind, type McpPermissions } from "../../../contracts/McpContracts";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Credencial de un agente de IA (MCP). Reglas puras: nombre, permisos por
// área (y su traducción a los permisos internos de la plataforma), huella del
// token y vencimiento. El token nunca se guarda: solo su huella SHA-256 (es
// aleatorio de 32 bytes, no se puede adivinar) y una pista. Las de tipo
// `oauth` no tienen token propio: sus tokens rotan (`OAuth.ts`).
// ---------------------------------------------------------------------------

export interface McpCredential {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: McpCredentialKind;
  readonly name: string;
  readonly permissions: McpPermissions;
  /** Huella del token fijo (`token`); `null` en las de OAuth. */
  readonly tokenHash: string | null;
  /** El agente registrado que la autorizó (solo `oauth`). */
  readonly clientId: string | null;
  readonly hint: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
}

/** Lo que obtiene un agente al presentar un token válido. */
export interface McpAccess {
  readonly tenantId: string;
  readonly credentialId: string;
  readonly credentialName: string;
  readonly scopes: ReadonlySet<Scope>;
}

const LEVELS: ReadonlyArray<McpAccessLevel> = ["none", "read", "write"];

/** Qué permisos internos da cada área en cada nivel (ver o ver y editar). */
const SCOPES: Readonly<Record<McpAreaId, { readonly read: ReadonlyArray<Scope>; readonly write: ReadonlyArray<Scope> }>> = {
  flows: { read: ["flows.read"], write: ["flows.read", "flows.write"] },
  contacts: { read: ["contacts.read"], write: ["contacts.read", "contacts.write"] },
  conversations: { read: ["conversations.read"], write: ["conversations.read", "conversations.write"] },
  connections: { read: ["connections.read"], write: ["connections.read", "connections.write"] },
  sales: { read: ["sales.read"], write: ["sales.read", "sales.write", "sales.manage"] },
  crm: { read: ["crm.read"], write: ["crm.read", "crm.write"] },
  analytics: { read: ["analytics.read", "ads.read"], write: ["analytics.read", "ads.read"] }
};

export function requireCredentialName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new ValidationError("Ponle un nombre a la credencial (p. ej. «Claude de ventas»).");
  if (name.length > 60) throw new ValidationError("El nombre admite hasta 60 caracteres.");
  return name;
}

/** Permisos válidos: áreas conocidas, «editar» solo donde existe, al menos un área con acceso. */
export function requirePermissions(raw: unknown): McpPermissions {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const permissions: Partial<Record<McpAreaId, McpAccessLevel>> = {};
  for (const area of MCP_AREAS) {
    const level = value[area.id];
    if (level === undefined || level === "none") continue;
    if (!LEVELS.includes(level as McpAccessLevel)) throw new ValidationError(`Permiso no válido para «${area.label}».`);
    if (level === "write" && !area.write) throw new ValidationError(`«${area.label}» solo se puede ver.`);
    permissions[area.id] = level as McpAccessLevel;
  }
  if (Object.keys(permissions).length === 0) throw new ValidationError("Dale acceso al menos a un área.");
  return permissions;
}

export function scopesOf(permissions: McpPermissions): ReadonlySet<Scope> {
  const scopes = new Set<Scope>();
  for (const [area, level] of Object.entries(permissions) as Array<[McpAreaId, McpAccessLevel]>) {
    if (level === "read" || level === "write") for (const scope of SCOPES[area][level]) scopes.add(scope);
  }
  return scopes;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isExpired(credential: Pick<McpCredential, "expiresAt">, now: Date): boolean {
  return credential.expiresAt !== null && Date.parse(credential.expiresAt) <= now.getTime();
}
