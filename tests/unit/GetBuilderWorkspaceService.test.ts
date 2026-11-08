import { describe, it, expect, beforeEach } from "vitest";
import { GetBuilderWorkspaceService } from "../../domains/automations/builder/application/GetBuilderWorkspaceService.js";
import type { BuilderWorkspaceRepository } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";

// ---- Stubs ----

class InMemoryWorkspaceRepo implements BuilderWorkspaceRepository {
  private items = new Map<string, PersistedBuilderWorkspace>();
  async getWorkspace(tenantId: string, flowKey: string) { return this.items.get(`${tenantId}:${flowKey}`) ?? null; }
  async getWorkspaces(tenantId: string, flowKeys: readonly string[]) {
    const workspaces = await Promise.all(flowKeys.map((flowKey) => this.getWorkspace(tenantId, flowKey)));
    return workspaces.filter((workspace): workspace is PersistedBuilderWorkspace => workspace !== null);
  }
  async saveWorkspace(ws: PersistedBuilderWorkspace) { this.items.set(`${ws.tenantId}:${ws.flowKey}`, ws); }
  async deleteWorkspace(tenantId: string, flowKey: string) { this.items.delete(`${tenantId}:${flowKey}`); }
  saved() { return [...this.items.values()]; }
}

class InMemoryAutomationRepo implements AutomationRepository {
  private items: AutomationFlow[] = [];
  async findByTenant(tenantId: string) { return this.items.filter((f) => f.tenantId === tenantId); }
  async findById(tenantId: string, id: string) { return this.items.find((f) => f.tenantId === tenantId && f.id === id); }
  async save(flow: AutomationFlow) {
    const idx = this.items.findIndex((f) => f.tenantId === flow.tenantId && f.id === flow.id);
    if (idx >= 0) this.items[idx] = flow; else this.items.push(flow);
  }
  async delete(tenantId: string, id: string) {
    this.items = this.items.filter((f) => !(f.tenantId === tenantId && f.id === id));
  }
  all() { return [...this.items]; }
}

const makeWorkspace = (tenantId: string, flowKey: string): PersistedBuilderWorkspace => ({
  tenantId,
  flowKey,
  draft: {
    flow: { id: flowKey, key: flowKey, name: "Nueva automatización" },
    version: { id: `${flowKey}:v1:draft`, versionNumber: 1, status: "draft", entryNodeId: "start_message" },
    nodes: {},
    edgesBySource: {}
  },
  updatedAt: new Date().toISOString(),
  autosaveRevision: 0
});

// ---- Tests ----

describe("GetBuilderWorkspaceService", () => {
  let workspaceRepo: InMemoryWorkspaceRepo;
  let automationRepo: InMemoryAutomationRepo;
  let sut: GetBuilderWorkspaceService;

  beforeEach(() => {
    workspaceRepo = new InMemoryWorkspaceRepo();
    automationRepo = new InMemoryAutomationRepo();
    sut = new GetBuilderWorkspaceService(workspaceRepo, makeWorkspace, automationRepo);
  });

  it("retorna workspace existente sin crear uno nuevo", async () => {
    const existing = makeWorkspace("tenant-1", "flow-a");
    await workspaceRepo.saveWorkspace(existing);
    const result = await sut.execute("tenant-1", "flow-a");
    expect(result.flowKey).toBe("flow-a");
    expect(workspaceRepo.saved()).toHaveLength(1); // no duplicado
  });

  it("abrir NO crea nada: un id desconocido devuelve null", async () => {
    // Antes creaba la automatización desde un GET (y con permiso de lectura).
    const result = await sut.execute("tenant-1", "flow-nuevo");
    expect(result).toBeNull();
    expect(workspaceRepo.saved()).toHaveLength(0);
    expect(automationRepo.all()).toHaveLength(0);
  });

  it("si el catálogo la tiene pero no hay borrador, sirve el inicial SIN guardarlo", async () => {
    await automationRepo.save({
      id: "flow-sin-borrador", tenantId: "tenant-abc", key: "flow-sin-borrador", name: "Recién creada",
      status: "draft", metadata: { createdAt: "2024-01-01", updatedAt: "2024-01-01" }
    });
    const result = await sut.execute("tenant-abc", "flow-sin-borrador");

    expect(result?.tenantId).toBe("tenant-abc");
    expect(result?.draft.flow.name).toBe("Recién creada");
    expect(workspaceRepo.saved()).toHaveLength(0);
  });

  it("NO crea entrada en AutomationRepository si el workspace ya existía", async () => {
    const existing = makeWorkspace("tenant-1", "flow-existente");
    await workspaceRepo.saveWorkspace(existing);
    await sut.execute("tenant-1", "flow-existente");
    expect(automationRepo.all()).toHaveLength(0);
  });

});
