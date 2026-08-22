import { describe, it, expect, beforeEach } from "vitest";
import { DeleteAutomationService } from "../../domains/automations/builder/application/DeleteAutomationService.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { BuilderWorkspaceRepository } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";

// ---- Stubs ----

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
  seed(flow: AutomationFlow) { this.items.push(flow); return this; }
  all() { return [...this.items]; }
}

class InMemoryWorkspaceRepo implements BuilderWorkspaceRepository {
  private items = new Map<string, PersistedBuilderWorkspace>();

  async getWorkspace(tenantId: string, flowKey: string) { return this.items.get(`${tenantId}:${flowKey}`) ?? null; }
  async saveWorkspace(ws: PersistedBuilderWorkspace) { this.items.set(`${ws.tenantId}:${ws.flowKey}`, ws); }
  async deleteWorkspace(tenantId: string, flowKey: string) { this.items.delete(`${tenantId}:${flowKey}`); }
  has(tenantId: string, flowKey: string) { return this.items.has(`${tenantId}:${flowKey}`); }
}

const SAMPLE_FLOW: AutomationFlow = {
  id: "flow-1",
  tenantId: "test-tenant",
  key: "flow-key-1",
  name: "Mi Flow",
  status: "draft",
  metadata: { createdAt: "2024-01-01", updatedAt: "2024-01-01" }
};

const SAMPLE_WORKSPACE: PersistedBuilderWorkspace = {
  tenantId: "test-tenant",
  flowKey: "flow-key-1",
  draft: {
    flow: { id: "flow-key-1", key: "flow-key-1", name: "Mi Flow" },
    version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "n1" },
    nodes: {},
    edgesBySource: {}
  },
  publishedSnapshots: [],
  updatedAt: "2024-01-01",
  autosaveRevision: 0
};

// ---- Tests ----

describe("DeleteAutomationService", () => {
  let automationRepo: InMemoryAutomationRepo;
  let workspaceRepo: InMemoryWorkspaceRepo;
  let sut: DeleteAutomationService;

  beforeEach(() => {
    automationRepo = new InMemoryAutomationRepo();
    workspaceRepo = new InMemoryWorkspaceRepo();
    sut = new DeleteAutomationService(automationRepo, workspaceRepo);
  });

  it("elimina el flow del catálogo", async () => {
    automationRepo.seed(SAMPLE_FLOW);
    await sut.execute("test-tenant", "flow-1");
    expect(automationRepo.all()).toHaveLength(0);
  });

  it("elimina el workspace del builder", async () => {
    automationRepo.seed(SAMPLE_FLOW);
    await workspaceRepo.saveWorkspace(SAMPLE_WORKSPACE);
    await sut.execute("test-tenant", "flow-1");
    expect(workspaceRepo.has("test-tenant", "flow-key-1")).toBe(false);
  });

  it("es idempotente: no lanza si el flow no existe", async () => {
    await expect(sut.execute("test-tenant", "flow-inexistente")).resolves.toBeUndefined();
  });

  it("no elimina flows de otro tenant", async () => {
    automationRepo.seed(SAMPLE_FLOW);
    automationRepo.seed({ ...SAMPLE_FLOW, id: "flow-2", tenantId: "tenant-otro" });
    await sut.execute("test-tenant", "flow-1");
    expect(automationRepo.all()).toHaveLength(1);
    expect(automationRepo.all()[0]?.tenantId).toBe("tenant-otro");
  });

  it("usa el flowKey del flow para eliminar el workspace", async () => {
    const flow = { ...SAMPLE_FLOW, id: "my-id", key: "my-key" };
    const ws = { ...SAMPLE_WORKSPACE, flowKey: "my-key" };
    automationRepo.seed(flow);
    await workspaceRepo.saveWorkspace(ws);
    await sut.execute("test-tenant", "my-id");
    expect(workspaceRepo.has("test-tenant", "my-key")).toBe(false);
  });
});
