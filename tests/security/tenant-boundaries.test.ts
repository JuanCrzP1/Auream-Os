import { describe, it, expect } from "vitest";
import { AuthorizationService } from "../../platform/authorization/application/AuthorizationService.js";
import { actorFromContext } from "../../platform/authorization/application/ActorFactory.js";
import { requireTenantAccess } from "../../platform/authorization/guards/requireTenantAccess.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext, makeActor } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Multi-tenant boundary — escenarios de ataque simulados
// ---------------------------------------------------------------------------

describe("Multi-tenant boundary attacks", () => {
  const authzSvc = new AuthorizationService();

  it("actor de tenant-a no puede leer flows de tenant-b", () => {
    const actor = makeActor({ tenantId: "tenant-a", scopes: ["flows.read"] });
    expect(authzSvc.can(actor, "flows.read", "tenant-b").granted).toBe(false);
  });

  it("actor de tenant-a no puede publicar en tenant-b aunque tenga todos los scopes", () => {
    const actor = makeActor({
      tenantId: "tenant-a",
      scopes: ["flows.read", "flows.write", "flows.publish", "runtime.execute", "analytics.read", "tenant.manage"]
    });
    expect(authzSvc.can(actor, "flows.publish", "tenant-b").granted).toBe(false);
  });

  it("actorFromContext descarta claims de scopes no reconocidos (inyección)", () => {
    const context = makeContext({
      scopes: ["flows.publish", "admin.override", "system.root"] as never
    });
    const actor = actorFromContext(context);
    expect(actor.scopes).toEqual(["flows.publish"]);
    expect(actor.scopes).not.toContain("admin.override");
    expect(actor.scopes).not.toContain("system.root");
  });

  it("actor con tenant vacío no accede a ningún tenant real", () => {
    const actor = makeActor({ tenantId: "", scopes: ["flows.read"] });
    expect(authzSvc.can(actor, "flows.read", "test-tenant").granted).toBe(false);
  });
});
