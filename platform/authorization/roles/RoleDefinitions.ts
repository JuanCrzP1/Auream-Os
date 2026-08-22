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
    "tenant.manage"
  ],
  tenant_owner: [
    "flows.read",
    "flows.write",
    "flows.publish",
    "runtime.execute",
    "analytics.read",
    "tenant.manage"
  ],
  tenant_admin: [
    "flows.read",
    "flows.write",
    "flows.publish",
    "runtime.execute",
    "analytics.read"
  ],
  operator: [
    "flows.read",
    "flows.write",
    "runtime.execute",
    "analytics.read"
  ],
  viewer: [
    "flows.read",
    "analytics.read"
  ],
  api_client: [
    "flows.read",
    "flows.write",
    "runtime.execute"
  ],
  worker: [
    "runtime.execute"
  ]
} as const;
