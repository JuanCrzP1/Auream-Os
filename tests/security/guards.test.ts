import { describe, it, expect } from "vitest";
import { requireScope } from "../../platform/authorization/guards/requireScope.js";
import { requireRole } from "../../platform/authorization/guards/requireRole.js";
import { requireTenantAccess } from "../../platform/authorization/guards/requireTenantAccess.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// requireScope (guard)
// ---------------------------------------------------------------------------

describe("requireScope (guard)", () => {
  it("no lanza cuando el actor tiene el scope sobre el tenant correcto", () => {
    const context = makeContext({ scopes: ["flows.read"] });
    expect(() => requireScope(context, "flows.read", "test-tenant")).not.toThrow();
  });

  it("lanza AccessError (403) cuando falta el scope", () => {
    const context = makeContext({ scopes: ["flows.read"] });
    expect(() => requireScope(context, "flows.publish", "test-tenant"))
      .toThrow(AccessError);
  });

  it("el AccessError contiene statusCode 403", () => {
    const context = makeContext({ scopes: [] });
    try {
      requireScope(context, "flows.write", "test-tenant");
      expect.fail("debería haber lanzado");
    } catch (e) {
      expect(e).toBeInstanceOf(AccessError);
      expect((e as AccessError).statusCode).toBe(403);
    }
  });

  it("lanza AccessError (403) en intento cross-tenant", () => {
    const context = makeContext({ tenantId: "tenant-a", scopes: ["flows.read"] });
    expect(() => requireScope(context, "flows.read", "tenant-b"))
      .toThrow(AccessError);
  });

  it("el error cross-tenant contiene información del tenant origen", () => {
    const context = makeContext({ tenantId: "tenant-attacker", scopes: ["flows.publish"] });
    try {
      requireScope(context, "flows.publish", "tenant-victim");
      expect.fail("debería haber lanzado");
    } catch (e) {
      expect((e as Error).message).toContain("tenant-attacker");
    }
  });

  it("actor sin ningún scope no puede acceder a ningún recurso", () => {
    const context = makeContext({ scopes: [] });
    const scopes = ["flows.read", "flows.write", "flows.publish", "runtime.execute", "analytics.read", "tenant.manage"] as const;
    for (const scope of scopes) {
      expect(() => requireScope(context, scope, "test-tenant")).toThrow(AccessError);
    }
  });
});

// ---------------------------------------------------------------------------
// requireTenantAccess (guard)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// requireTenantAccess (guard)
// ---------------------------------------------------------------------------

describe("requireTenantAccess (guard)", () => {
  it("no lanza cuando el tenant coincide", () => {
    const context = makeContext();
    expect(() => requireTenantAccess(context, "test-tenant")).not.toThrow();
  });

  it("lanza AccessError (403) cuando el tenant no coincide", () => {
    const context = makeContext({ tenantId: "tenant-a" });
    expect(() => requireTenantAccess(context, "tenant-b")).toThrow(AccessError);
  });
});

// ---------------------------------------------------------------------------
// requireRole (guard)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// requireRole (guard)
// ---------------------------------------------------------------------------

describe("requireRole (guard)", () => {
  it("viewer satisfecho cuando tiene flows.read y analytics.read", () => {
    const context = makeContext({ scopes: ["flows.read", "analytics.read"] });
    expect(() => requireRole(context, "viewer")).not.toThrow();
  });

  it("viewer no satisfecho cuando falta analytics.read", () => {
    const context = makeContext({ scopes: ["flows.read"] });
    expect(() => requireRole(context, "viewer")).toThrow(AccessError);
  });

  it("worker satisfecho con solo runtime.execute", () => {
    const context = makeContext({ scopes: ["runtime.execute"] });
    expect(() => requireRole(context, "worker")).not.toThrow();
  });

  it("tenant_admin no satisfecho con scopes de viewer", () => {
    const context = makeContext({ scopes: ["flows.read", "analytics.read"] });
    expect(() => requireRole(context, "tenant_admin")).toThrow(AccessError);
  });

  it("el error incluye los scopes que faltan", () => {
    const context = makeContext({ scopes: ["flows.read"] });
    try {
      requireRole(context, "tenant_admin");
      expect.fail("debería haber lanzado");
    } catch (e) {
      expect((e as Error).message).toContain("Missing scopes");
    }
  });

  it("tenant_owner satisfecho con todos los scopes", () => {
    const context = makeContext({
      scopes: ["flows.read", "flows.write", "flows.publish", "runtime.execute", "analytics.read", "tenant.manage"]
    });
    expect(() => requireRole(context, "tenant_owner")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Multi-tenant boundary — escenarios de ataque simulados
// ---------------------------------------------------------------------------
