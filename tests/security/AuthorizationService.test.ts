import { describe, it, expect } from "vitest";
import { AuthorizationService } from "../../platform/authorization/application/AuthorizationService.js";
import { actorFromContext } from "../../platform/authorization/application/ActorFactory.js";
import { makeContext, makeActor } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// AuthorizationService
// ---------------------------------------------------------------------------

describe("AuthorizationService", () => {
  const svc = new AuthorizationService();

  it("otorga acceso cuando tenant y scope son correctos", () => {
    const actor = makeActor();
    const decision = svc.can(actor, "flows.read", "test-tenant");
    expect(decision.granted).toBe(true);
  });

  it("deniega cuando falta el scope requerido", () => {
    const actor = makeActor({ scopes: ["flows.read"] });
    const decision = svc.can(actor, "flows.publish", "test-tenant");
    expect(decision.granted).toBe(false);
    if (!decision.granted) {
      expect(decision.reason).toContain("flows.publish");
    }
  });

  it("deniega cross-tenant aunque el scope esté presente", () => {
    const actor = makeActor({ tenantId: "tenant-a" });
    const decision = svc.can(actor, "flows.read", "tenant-b");
    expect(decision.granted).toBe(false);
    if (!decision.granted) {
      expect(decision.reason).toContain("tenant-a");
      expect(decision.reason).toContain("tenant-b");
    }
  });

  it("deniega cross-tenant incluso con todos los scopes", () => {
    const actor = makeActor({
      tenantId: "tenant-attacker",
      scopes: ["flows.read", "flows.write", "flows.publish", "runtime.execute", "analytics.read", "tenant.manage"]
    });
    const decision = svc.can(actor, "flows.publish", "tenant-victim");
    expect(decision.granted).toBe(false);
  });

  it("filtra scopes desconocidos en actorFromContext", () => {
    const context = makeContext({ scopes: ["flows.read", "unknown.scope", "injected.claim"] as never });
    const actor = actorFromContext(context);
    expect(actor.scopes).toContain("flows.read");
    expect(actor.scopes).not.toContain("unknown.scope");
    expect(actor.scopes).not.toContain("injected.claim");
  });
});

// ---------------------------------------------------------------------------
// TenantAccessPolicy
// ---------------------------------------------------------------------------
