import { describe, expect, it } from "vitest";
import {
  toAutomationListResponse,
  toAutomationSummary
} from "../../apps/api/http/toAutomationListResponse.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";

// ---------------------------------------------------------------------------
// Contrato de `GET /automations`.
//
// Protege el desajuste real que existió: el backend enviaba la entidad de
// dominio con `metadata.updatedAt` anidado mientras el frontend leía
// `updatedAt` en la raíz, de modo que la tarjeta renderizaba "Invalid Date".
//
// El fixture reproduce la forma REAL persistida en data/builder-workspaces.
// Si alguien mueve `updatedAt` dentro o fuera de `metadata`, este test falla.
// ---------------------------------------------------------------------------

const persistedFlow: AutomationFlow = {
  id: "6e4a6956-b3bf-4208-8e29-9c041caf67c8",
  tenantId: "test-tenant",
  key: "6e4a6956-b3bf-4208-8e29-9c041caf67c8",
  name: "aaaa",
  status: "draft",
  metadata: {
    createdAt: "2026-05-26T15:36:25.853Z",
    updatedAt: "2026-05-26T20:02:06.889Z"
  }
};

describe("contrato GET /automations", () => {
  it("expone updatedAt en la raiz, no anidado en metadata", () => {
    const summary = toAutomationSummary(persistedFlow);

    expect(summary.updatedAt).toBe("2026-05-26T20:02:06.889Z");
    expect(new Date(summary.updatedAt).toString()).not.toBe("Invalid Date");
    expect(summary).not.toHaveProperty("metadata");
  });

  it("NUNCA expone tenantId al cliente", () => {
    const summary = toAutomationSummary(persistedFlow);

    expect(summary).not.toHaveProperty("tenantId");
  });

  it("expone exactamente las claves del contrato y ninguna mas", () => {
    const summary = toAutomationSummary(persistedFlow);

    expect(Object.keys(summary).sort()).toEqual(["id", "key", "name", "status", "updatedAt"]);
  });

  it("propaga tags a la raiz cuando existen", () => {
    const withTags: AutomationFlow = {
      ...persistedFlow,
      folderId: "folder-1",
      metadata: { ...persistedFlow.metadata, tags: ["soporte", "ventas"] }
    };

    const summary = toAutomationSummary(withTags);

    expect(summary.tags).toEqual(["soporte", "ventas"]);
    expect(summary.folderId).toBe("folder-1");
  });

  it("omite las claves opcionales en lugar de emitirlas como undefined", () => {
    const summary = toAutomationSummary(persistedFlow);

    expect("tags" in summary).toBe(false);
    expect("folderId" in summary).toBe(false);
  });

  it("mapea la respuesta completa de listado", () => {
    const folder: AutomationFolder = {
      id: "folder-1",
      tenantId: "test-tenant",
      name: "Ventas",
      createdAt: "2026-05-01T00:00:00.000Z"
    };

    const response = toAutomationListResponse({ flows: [persistedFlow], folders: [folder] });

    expect(response.flows).toHaveLength(1);
    expect(response.folders).toEqual([{ id: "folder-1", name: "Ventas" }]);
    expect(response.folders[0]).not.toHaveProperty("tenantId");
    expect(response.folders[0]).not.toHaveProperty("createdAt");
  });

  it("sobrevive al viaje por JSON sin perder la forma", () => {
    const roundTripped = JSON.parse(
      JSON.stringify(toAutomationListResponse({ flows: [persistedFlow], folders: [] }))
    );

    expect(roundTripped.flows[0].updatedAt).toBe("2026-05-26T20:02:06.889Z");
  });
});
