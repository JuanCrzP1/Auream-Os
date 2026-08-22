import { describe, it, expect } from "vitest";
import { CapabilityResolver } from "../../domains/billing/application/CapabilityResolver.js";
import { TenantLimits } from "../../domains/billing/limits/TenantLimits.js";
import { PLAN_CAPABILITIES } from "../../domains/billing/plans/PlanDefinitions.js";
import { InMemorySubscriptionRepository } from "../../infrastructure/persistence/memory/InMemorySubscriptionRepository.js";
import type { Subscription } from "../../domains/billing/contracts/Subscription.js";

function makeSubscription(
  tenantId: string,
  planId: Subscription["planId"],
  status: Subscription["status"] = "active"
): Subscription {
  return {
    tenantId,
    planId,
    status,
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString()
  };
}

describe("PLAN_CAPABILITIES", () => {
  it("cubre los tres planes: free, pro, enterprise", () => {
    expect(PLAN_CAPABILITIES["free"]).toBeDefined();
    expect(PLAN_CAPABILITIES["pro"]).toBeDefined();
    expect(PLAN_CAPABILITIES["enterprise"]).toBeDefined();
  });

  it("plan free tiene aiEnabled=false y maxFlows=3", () => {
    const free = PLAN_CAPABILITIES["free"]!;
    expect(free.aiEnabled).toBe(false);
    expect(free.maxFlows).toBe(3);
    expect(free.maxExecutionsPerMonth).toBe(1000);
  });

  it("plan pro tiene aiEnabled=true y analyticsEnabled=true", () => {
    const pro = PLAN_CAPABILITIES["pro"]!;
    expect(pro.aiEnabled).toBe(true);
    expect(pro.analyticsEnabled).toBe(true);
    expect(pro.maxFlows).toBe(25);
  });

  it("plan enterprise tiene límites infinitos", () => {
    const ent = PLAN_CAPABILITIES["enterprise"]!;
    expect(ent.maxFlows).toBe(Infinity);
    expect(ent.maxExecutionsPerMonth).toBe(Infinity);
  });
});

describe("CapabilityResolver", () => {
  it("retorna plan free si no hay suscripción", () => {
    const repo = new InMemorySubscriptionRepository();
    const resolver = new CapabilityResolver(repo);
    const caps = resolver.resolve("tenant-sin-plan");
    expect(caps).toEqual(PLAN_CAPABILITIES["free"]);
  });

  it("retorna plan free si suscripción cancelada", () => {
    const repo = new InMemorySubscriptionRepository();
    repo.save(makeSubscription("tenant-a", "pro", "cancelled"));
    const resolver = new CapabilityResolver(repo);
    expect(resolver.resolve("tenant-a")).toEqual(PLAN_CAPABILITIES["free"]);
  });

  it("retorna capabilities pro con suscripción activa pro", () => {
    const repo = new InMemorySubscriptionRepository();
    repo.save(makeSubscription("tenant-b", "pro"));
    const resolver = new CapabilityResolver(repo);
    expect(resolver.resolve("tenant-b")).toEqual(PLAN_CAPABILITIES["pro"]);
  });

  it("retorna capabilities enterprise con suscripción enterprise activa", () => {
    const repo = new InMemorySubscriptionRepository();
    repo.save(makeSubscription("tenant-c", "enterprise"));
    const resolver = new CapabilityResolver(repo);
    expect(resolver.resolve("tenant-c")).toEqual(PLAN_CAPABILITIES["enterprise"]);
  });
});

describe("TenantLimits", () => {
  it("canCreateFlow retorna true si está por debajo del límite", () => {
    const limits = new TenantLimits(PLAN_CAPABILITIES["free"]!);
    expect(limits.canCreateFlow(2)).toBe(true);
  });

  it("canCreateFlow retorna false al alcanzar el límite", () => {
    const limits = new TenantLimits(PLAN_CAPABILITIES["free"]!);
    expect(limits.canCreateFlow(3)).toBe(false);
  });

  it("plan free no tiene AI", () => {
    const limits = new TenantLimits(PLAN_CAPABILITIES["free"]!);
    expect(limits.hasAi()).toBe(false);
  });

  it("plan pro tiene AI", () => {
    const limits = new TenantLimits(PLAN_CAPABILITIES["pro"]!);
    expect(limits.hasAi()).toBe(true);
  });

  it("plan enterprise tiene analytics", () => {
    const limits = new TenantLimits(PLAN_CAPABILITIES["enterprise"]!);
    expect(limits.hasAnalytics()).toBe(true);
  });
});
