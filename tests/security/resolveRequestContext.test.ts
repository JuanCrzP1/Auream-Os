import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { resolveRequestContext } from "../../apps/api/middleware/resolveRequestContext.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import type { AuthenticatedPrincipal } from "../../platform/identity/contracts/AuthenticatedPrincipal.js";
import type { Membership } from "../../domains/team/contracts/Membership.js";
import type {
  MembershipRepository,
  MembershipWithTenant
} from "../../domains/team/application/MembershipRepository.js";

// ---------------------------------------------------------------------------
// El tenant que envía el cliente es una SELECCIÓN, nunca una afirmación.
// Estos tests fijan que la selección se valida contra memberships reales y que
// los scopes se derivan del rol en base de datos, no de la petición.
// ---------------------------------------------------------------------------

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function membership(userId: string, tenantId: string, role: Membership["role"]): Membership {
  return { userId, tenantId, role, status: "active" };
}

function repositoryWith(memberships: ReadonlyArray<Membership>): MembershipRepository {
  return {
    findActive: async (userId, tenantId) =>
      memberships.find((m) => m.userId === userId && m.tenantId === tenantId) ?? null,
    findActiveByUser: async (userId): Promise<ReadonlyArray<MembershipWithTenant>> =>
      memberships
        .filter((m) => m.userId === userId)
        .map((m) => ({ membership: m, tenantKey: "k", tenantName: "n" }))
  };
}

function userPrincipal(actorId: string): AuthenticatedPrincipal {
  return { kind: "user", identity: { actorId } };
}

function requestWithTenant(tenantId?: string): IncomingMessage {
  return { headers: tenantId ? { "x-tenant-id": tenantId } : {} } as unknown as IncomingMessage;
}

describe("resolveRequestContext — aislamiento de tenant", () => {
  it("usuario con membership en el tenant seleccionado obtiene contexto", async () => {
    const repo = repositoryWith([membership(USER_A, TENANT_A, "operator")]);

    const result = await resolveRequestContext(
      requestWithTenant(TENANT_A),
      userPrincipal(USER_A),
      repo
    );

    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    expect(result.context.tenantId).toBe(TENANT_A);
    expect(result.context.scopes).toEqual(ROLE_SCOPES.operator);
  });

  it("IDOR: usuario pide un tenant donde NO tiene membership → forbidden", async () => {
    const repo = repositoryWith([membership(USER_A, TENANT_A, "tenant_owner")]);

    const result = await resolveRequestContext(
      requestWithTenant(TENANT_B),
      userPrincipal(USER_A),
      repo
    );

    expect(result.outcome).toBe("forbidden");
  });

  it("usuario sin ninguna membership → forbidden", async () => {
    const result = await resolveRequestContext(
      requestWithTenant(),
      userPrincipal(USER_A),
      repositoryWith([])
    );

    expect(result.outcome).toBe("forbidden");
  });

  it("un solo tenant y sin cabecera → se resuelve automáticamente", async () => {
    const repo = repositoryWith([membership(USER_A, TENANT_A, "viewer")]);

    const result = await resolveRequestContext(requestWithTenant(), userPrincipal(USER_A), repo);

    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    expect(result.context.tenantId).toBe(TENANT_A);
  });

  it("varios tenants y sin cabecera → exige selección explícita, nunca elige por su cuenta", async () => {
    const repo = repositoryWith([
      membership(USER_A, TENANT_A, "tenant_owner"),
      membership(USER_A, TENANT_B, "viewer")
    ]);

    const result = await resolveRequestContext(requestWithTenant(), userPrincipal(USER_A), repo);

    expect(result.outcome).toBe("tenant_required");
  });

  it("los scopes provienen del rol en base de datos, no de la petición", async () => {
    const repo = repositoryWith([membership(USER_A, TENANT_A, "viewer")]);

    const result = await resolveRequestContext(
      requestWithTenant(TENANT_A),
      userPrincipal(USER_A),
      repo
    );

    if (result.outcome !== "resolved") throw new Error("esperaba resolved");
    // viewer no puede publicar ni escribir, por mucho que el cliente lo pida
    expect(result.context.scopes).not.toContain("flows.publish");
    expect(result.context.scopes).not.toContain("flows.write");
    expect(result.context.scopes).toContain("flows.read");
  });

  it("cambiar de rol cambia los scopes inmediatamente (sin esperar al token)", async () => {
    const asOwner = await resolveRequestContext(
      requestWithTenant(TENANT_A),
      userPrincipal(USER_A),
      repositoryWith([membership(USER_A, TENANT_A, "tenant_owner")])
    );
    const asViewer = await resolveRequestContext(
      requestWithTenant(TENANT_A),
      userPrincipal(USER_A),
      repositoryWith([membership(USER_A, TENANT_A, "viewer")])
    );

    if (asOwner.outcome !== "resolved" || asViewer.outcome !== "resolved") {
      throw new Error("esperaba ambos resolved");
    }

    expect(asOwner.context.scopes).toContain("tenant.manage");
    expect(asViewer.context.scopes).not.toContain("tenant.manage");
  });

  it("una credencial de máquina conserva su tenant y scopes de origen", async () => {
    const principal: AuthenticatedPrincipal = {
      kind: "machine",
      identity: { tenantId: TENANT_B, actorId: "worker-1", scopes: ["runtime.execute"] }
    };

    const result = await resolveRequestContext(
      requestWithTenant(TENANT_A),
      principal,
      repositoryWith([])
    );

    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    // La cabecera NO puede reasignar el tenant de una API key.
    expect(result.context.tenantId).toBe(TENANT_B);
    expect(result.context.authMethod).toBe("api_key");
  });
});
