import { describe, expect, it } from "vitest";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import type { Role } from "../../platform/authorization/contracts/Role.js";
import type { Membership } from "../../domains/team/contracts/Membership.js";
import { actorFromContext } from "../../platform/authorization/application/ActorFactory.js";
import type { RequestContext } from "../../platform/identity/contracts/RequestContext.js";

// ---------------------------------------------------------------------------
// Cadena USER → MEMBERSHIP → TENANT → ROLE → SCOPES → RESOURCE.
//
// El modelo es conceptual (sin persistencia), pero la parte que YA existe
// —la traducción de rol a scopes y de contexto a actor— debe ser completa y
// coherente. Si alguien añade un rol sin scopes, la cadena se rompe en
// silencio: este test lo impide.
// ---------------------------------------------------------------------------

const ALL_ROLES: ReadonlyArray<Role> = [
  "platform_admin",
  "tenant_owner",
  "tenant_admin",
  "operator",
  "viewer",
  "api_client",
  "worker"
];

/** Resuelve la membership hasta los scopes efectivos, como hará Fase 1. */
function scopesForMembership(membership: Membership): ReadonlyArray<string> {
  if (membership.status !== "active") {
    return [];
  }

  return ROLE_SCOPES[membership.role];
}

describe("modelo de membership", () => {
  it("todo rol declarado otorga al menos un scope", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_SCOPES[role], `el rol '${role}' no tiene scopes`).toBeDefined();
      expect(ROLE_SCOPES[role].length, `el rol '${role}' no otorga nada`).toBeGreaterThan(0);
    }
  });

  it("una membership activa resuelve a los scopes de su rol", () => {
    const membership: Membership = {
      userId: "user-1",
      tenantId: "tenant-a",
      role: "operator",
      status: "active"
    };

    expect(scopesForMembership(membership)).toEqual(ROLE_SCOPES.operator);
  });

  it("una membership no activa no otorga ningun scope", () => {
    const invited: Membership = {
      userId: "user-1",
      tenantId: "tenant-a",
      role: "tenant_owner",
      status: "invited"
    };
    const revoked: Membership = { ...invited, status: "revoked" };

    expect(scopesForMembership(invited)).toEqual([]);
    expect(scopesForMembership(revoked)).toEqual([]);
  });

  it("el mismo usuario puede tener roles distintos en tenants distintos", () => {
    const owner: Membership = {
      userId: "user-1",
      tenantId: "tenant-a",
      role: "tenant_owner",
      status: "active"
    };
    const operator: Membership = {
      userId: "user-1",
      tenantId: "tenant-b",
      role: "operator",
      status: "active"
    };

    expect(scopesForMembership(owner)).toContain("tenant.manage");
    expect(scopesForMembership(operator)).not.toContain("tenant.manage");
  });

  it("el actor derivado conserva el tenant de la membership, no otro", () => {
    const membership: Membership = {
      userId: "user-1",
      tenantId: "tenant-b",
      role: "operator",
      status: "active"
    };

    const context: RequestContext = {
      tenantId: membership.tenantId,
      actorId: membership.userId,
      authMethod: "jwt",
      requestId: "req-1",
      scopes: scopesForMembership(membership)
    };

    const actor = actorFromContext(context);

    expect(actor.tenantId).toBe("tenant-b");
    expect(actor.scopes).toEqual(ROLE_SCOPES.operator);
  });
});
