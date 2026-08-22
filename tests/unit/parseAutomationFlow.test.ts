import { describe, expect, it } from "vitest";
import { isAutomationFlow } from "../../infrastructure/persistence/json/parseAutomationFlow.js";

// Frontera de confianza: lo que viene del disco no es AutomationFlow por decreto.

const valid = {
  id: "flow-1",
  tenantId: "tenant-a",
  key: "flow-1",
  name: "Captura",
  status: "draft",
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }
};

describe("isAutomationFlow", () => {
  it("acepta un flow bien formado", () => {
    expect(isAutomationFlow(valid)).toBe(true);
  });

  it("rechaza un status desconocido", () => {
    expect(isAutomationFlow({ ...valid, status: "pendiente" })).toBe(false);
  });

  it("rechaza metadata ausente o incompleta", () => {
    expect(isAutomationFlow({ ...valid, metadata: undefined })).toBe(false);
    expect(isAutomationFlow({ ...valid, metadata: { createdAt: "x" } })).toBe(false);
  });

  it("rechaza un flow sin tenantId", () => {
    const { tenantId: _omitted, ...sinTenant } = valid;
    expect(isAutomationFlow(sinTenant)).toBe(false);
  });

  it("rechaza valores que no son objeto", () => {
    expect(isAutomationFlow(null)).toBe(false);
    expect(isAutomationFlow("texto")).toBe(false);
    expect(isAutomationFlow(42)).toBe(false);
  });
});
