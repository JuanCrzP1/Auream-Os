import type { Role } from "../contracts/Role";
import type { Scope } from "../contracts/Scope";

// Mapa canónico: cada rol define exactamente qué scopes otorga.
// La autorización en runtime es scope-based; este mapa es la fuente de verdad
// para emitir tokens y para requireRole (comprobación por expansión de rol).
//
// Roles del equipo tal como los ve el cliente (domains/team): Dueño
// (tenant_owner), Administrador (tenant_admin), Asesor (operator) y Solo
// lectura (viewer). Principio: cada uno con lo que necesita. El Asesor atiende
// chats y contactos y VE las automatizaciones, sin editarlas: un flujo dañado
// por error afecta a todos los clientes (decisión del dueño, 2026-11-10).
export const ROLE_SCOPES: Readonly<Record<Role, ReadonlyArray<Scope>>> = {
  platform_admin: [
    "flows.read",
    "flows.write",
    "flows.publish",
    "runtime.execute",
    "analytics.read",
    "contacts.read",
    "contacts.write",
    "tenant.manage",
    "credentials.read",
    "credentials.write",
    "connections.read",
    "connections.write",
    "conversations.read",
    "conversations.write",
    "team.read",
    "team.manage"
  ],
  tenant_owner: [
    "flows.read",
    "flows.write",
    "flows.publish",
    "runtime.execute",
    "analytics.read",
    "contacts.read",
    "contacts.write",
    "tenant.manage",
    "credentials.read",
    "credentials.write",
    "connections.read",
    "connections.write",
    "conversations.read",
    "conversations.write",
    "team.read",
    "team.manage"
  ],
  tenant_admin: [
    "flows.read",
    "flows.write",
    "flows.publish",
    "runtime.execute",
    "analytics.read",
    "contacts.read",
    "contacts.write",
    "credentials.read",
    "credentials.write",
    "connections.read",
    "connections.write",
    "conversations.read",
    "conversations.write",
    "team.read",
    "team.manage"
  ],
  operator: [
    "flows.read",
    "runtime.execute",
    "analytics.read",
    "contacts.read",
    "contacts.write",
    "connections.read",
    "conversations.read",
    "conversations.write",
    "team.read"
  ],
  viewer: [
    "flows.read",
    "analytics.read",
    "contacts.read",
    "connections.read",
    "conversations.read",
    "team.read"
  ],
  api_client: [
    "flows.read",
    "flows.write",
    "runtime.execute",
    "contacts.read",
    "contacts.write"
  ],
  worker: [
    "runtime.execute"
  ]
} as const;
