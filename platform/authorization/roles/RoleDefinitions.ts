import type { Role } from "../contracts/Role";
import type { Scope } from "../contracts/Scope";

// Mapa canónico: cada rol define exactamente qué scopes otorga.
// La autorización en runtime es scope-based; este mapa es la fuente de verdad
// para emitir tokens y para requireRole (comprobación por expansión de rol).
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
    "conversations.write"
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
    "conversations.write"
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
    "conversations.write"
  ],
  operator: [
    "flows.read",
    "flows.write",
    "runtime.execute",
    "analytics.read",
    "contacts.read",
    "contacts.write",
    "credentials.read",
    "connections.read",
    "conversations.read",
    "conversations.write"
  ],
  viewer: [
    "flows.read",
    "analytics.read",
    "contacts.read",
    "connections.read",
    "conversations.read"
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
