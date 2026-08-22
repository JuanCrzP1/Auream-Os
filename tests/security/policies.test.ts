import { describe, it, expect } from "vitest";
import { TenantAccessPolicy } from "../../platform/authorization/policies/TenantAccessPolicy.js";
import { PublishFlowPolicy } from "../../platform/authorization/policies/PublishFlowPolicy.js";
import { RuntimeExecutionPolicy } from "../../platform/authorization/policies/RuntimeExecutionPolicy.js";
import { AnalyticsAccessPolicy } from "../../platform/authorization/policies/AnalyticsAccessPolicy.js";
import { makeActor } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// TenantAccessPolicy
// ---------------------------------------------------------------------------

describe("TenantAccessPolicy", () => {
  const policy = new TenantAccessPolicy();

  it("otorga acceso cuando el actor pertenece al tenant", () => {
    const actor = makeActor();
    expect(policy.evaluate(actor, "test-tenant").granted).toBe(true);
  });

  it("deniega acceso cuando el actor pertenece a otro tenant", () => {
    const actor = makeActor({ tenantId: "tenant-other" });
    const decision = policy.evaluate(actor, "test-tenant");
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toMatch(/tenant-other/);
  });
});

// ---------------------------------------------------------------------------
// PublishFlowPolicy
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PublishFlowPolicy
// ---------------------------------------------------------------------------

describe("PublishFlowPolicy", () => {
  const policy = new PublishFlowPolicy();

  it("otorga publicar cuando tiene scope y pertenece al tenant", () => {
    const actor = makeActor({ scopes: ["flows.publish"] });
    expect(policy.evaluate(actor, "test-tenant").granted).toBe(true);
  });

  it("deniega publicar cuando falta el scope flows.publish", () => {
    const actor = makeActor({ scopes: ["flows.read", "flows.write"] });
    const decision = policy.evaluate(actor, "test-tenant");
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toContain("flows.publish");
  });

  it("deniega publicar cross-tenant aunque tenga el scope", () => {
    const actor = makeActor({ tenantId: "tenant-attacker", scopes: ["flows.publish"] });
    const decision = policy.evaluate(actor, "tenant-victim");
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toContain("tenant-attacker");
  });

  it("deniega publicar con scopes forjados de otro tenant", () => {
    // Simula un token con tenant correcto en scopes pero tenantId equivocado
    const actor = makeActor({
      tenantId: "tenant-b",
      scopes: ["flows.read", "flows.publish"]
    });
    const decision = policy.evaluate(actor, "tenant-a");
    expect(decision.granted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RuntimeExecutionPolicy
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RuntimeExecutionPolicy
// ---------------------------------------------------------------------------

describe("RuntimeExecutionPolicy", () => {
  const policy = new RuntimeExecutionPolicy();

  it("otorga ejecución cuando tiene scope y pertenece al tenant", () => {
    const actor = makeActor({ scopes: ["runtime.execute"] });
    expect(policy.evaluate(actor, "test-tenant").granted).toBe(true);
  });

  it("deniega ejecución cuando falta el scope runtime.execute", () => {
    const actor = makeActor({ scopes: ["flows.read"] });
    const decision = policy.evaluate(actor, "test-tenant");
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toContain("runtime.execute");
  });

  it("deniega ejecución cross-tenant", () => {
    const actor = makeActor({ tenantId: "tenant-a", scopes: ["runtime.execute"] });
    const decision = policy.evaluate(actor, "tenant-b");
    expect(decision.granted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AnalyticsAccessPolicy
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AnalyticsAccessPolicy
// ---------------------------------------------------------------------------

describe("AnalyticsAccessPolicy", () => {
  const policy = new AnalyticsAccessPolicy();

  it("otorga lectura de analytics con scope y tenant correcto", () => {
    const actor = makeActor({ scopes: ["analytics.read"] });
    expect(policy.evaluate(actor, "test-tenant").granted).toBe(true);
  });

  it("deniega analytics sin el scope requerido", () => {
    const actor = makeActor({ scopes: ["flows.read"] });
    const decision = policy.evaluate(actor, "test-tenant");
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toContain("analytics.read");
  });
});

// ---------------------------------------------------------------------------
// requireScope (guard)
// ---------------------------------------------------------------------------
