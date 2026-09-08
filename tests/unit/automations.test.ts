import { describe, it, expect, beforeEach } from "vitest";
import { ListAutomationsService } from "../../domains/automations/catalog/application/ListAutomationsService.js";
import { toAutomationListResponse } from "../../apps/api/http/toAutomationListResponse.js";
import { CreateFolderService } from "../../domains/automations/catalog/application/CreateFolderService.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";
import type { BuilderWorkspaceRepository } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";

// ---- In-memory stubs ----

class InMemoryAutomationRepo implements AutomationRepository {
  private items: AutomationFlow[] = [];

  async findByTenant(tenantId: string) {
    return this.items.filter((f) => f.tenantId === tenantId);
  }

  async findById(tenantId: string, id: string) {
    return this.items.find((f) => f.tenantId === tenantId && f.id === id);
  }

  async save(flow: AutomationFlow) {
    const idx = this.items.findIndex((f) => f.tenantId === flow.tenantId && f.id === flow.id);
    if (idx >= 0) this.items[idx] = flow;
    else this.items.push(flow);
  }

  async delete(tenantId: string, id: string) {
    this.items = this.items.filter((f) => !(f.tenantId === tenantId && f.id === id));
  }

  seed(flow: AutomationFlow) {
    this.items.push(flow);
    return this;
  }
}

class InMemoryFolderRepo implements FolderRepository {
  private items: AutomationFolder[] = [];

  async findByTenant(tenantId: string) {
    return this.items.filter((f) => f.tenantId === tenantId);
  }

  async findById(tenantId: string, id: string) {
    return this.items.find((f) => f.tenantId === tenantId && f.id === id);
  }

  async save(folder: AutomationFolder) {
    this.items.push(folder);
  }
}

class InMemoryWorkspaceRepo implements BuilderWorkspaceRepository {
  private items = new Map<string, PersistedBuilderWorkspace>();
  reads = 0;
  async getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null> {
    return this.items.get(`${tenantId}:${flowKey}`) ?? null;
  }
  async getWorkspaces(tenantId: string, flowKeys: readonly string[]): Promise<PersistedBuilderWorkspace[]> {
    this.reads += 1;
    const workspaces = await Promise.all(flowKeys.map((flowKey) => this.getWorkspace(tenantId, flowKey)));
    return workspaces.filter((workspace): workspace is PersistedBuilderWorkspace => workspace !== null);
  }
  async saveWorkspace(): Promise<void> {}
  async deleteWorkspace(): Promise<void> {}
  seed(workspace: PersistedBuilderWorkspace) { this.items.set(`${workspace.tenantId}:${workspace.flowKey}`, workspace); }
  count() { return this.items.size; }
}

// ---- Tests ----

describe("ListAutomationsService", () => {
  let automationRepo: InMemoryAutomationRepo;
  let folderRepo: InMemoryFolderRepo;
  let workspaceRepo: InMemoryWorkspaceRepo;
  let sut: ListAutomationsService;

  beforeEach(() => {
    automationRepo = new InMemoryAutomationRepo();
    folderRepo = new InMemoryFolderRepo();
    workspaceRepo = new InMemoryWorkspaceRepo();
    sut = new ListAutomationsService(automationRepo, folderRepo, workspaceRepo);
  });

  it("returns empty lists when no data exists", async () => {
    const result = await sut.execute("tenant-1");
    expect(result.flows).toHaveLength(0);
    expect(result.folders).toHaveLength(0);
  });

  it("returns only flows belonging to the tenant", async () => {
    automationRepo.seed({
      id: "f1",
      tenantId: "tenant-1",
      key: "flow-1",
      name: "Flow 1",
      status: "active",
      metadata: { createdAt: "2024-01-01", updatedAt: "2024-01-01" }
    });
    automationRepo.seed({
      id: "f2",
      tenantId: "tenant-2",
      key: "flow-2",
      name: "Flow 2",
      status: "draft",
      metadata: { createdAt: "2024-01-01", updatedAt: "2024-01-01" }
    });

    const result = await sut.execute("tenant-1");
    expect(result.flows).toHaveLength(1);
    expect(result.flows[0].flow.id).toBe("f1");
  });

  it("returns flows and folders together", async () => {
    automationRepo.seed({
      id: "f1",
      tenantId: "t1",
      key: "flow-1",
      name: "Flow",
      status: "active",
      metadata: { createdAt: "2024-01-01", updatedAt: "2024-01-01" }
    });
    await folderRepo.save({ id: "folder-1", tenantId: "t1", name: "Carpeta A", createdAt: "2024-01-01" });

    const result = await sut.execute("t1");
    expect(result.flows).toHaveLength(1);
    expect(result.folders).toHaveLength(1);
  });

  it("deriva el resumen del draft y no crea workspaces ausentes", async () => {
    automationRepo.seed({ id: "f1", tenantId: "t1", key: "flow-1", name: "Flow", status: "draft", metadata: { createdAt: "x", updatedAt: "x" } });
    workspaceRepo.seed({
      tenantId: "t1", flowKey: "flow-1", updatedAt: "x", autosaveRevision: 0, publishedSnapshots: [],
      draft: {
        flow: { id: "f1", key: "flow-1", name: "Flow" },
        version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "inicio" },
        nodes: {
          inicio: { id: "inicio", type: "message", name: "Inicio", content: {}, config: {}, metadata: {} },
          fin: { id: "fin", type: "end", name: "Fin", content: {}, config: {}, metadata: {} }
        },
        edgesBySource: { inicio: [{ id: "e1", fromNodeId: "inicio", toNodeId: "fin", priority: 0, isFallback: false, condition: { operator: "always" } }] }
      }
    });

    const result = await sut.execute("t1");
    expect(result.flows[0]?.graphSummary).toEqual({ nodeCount: 2, connectionStatus: "connected" });
    expect(workspaceRepo.reads).toBe(1);
    expect(workspaceRepo.count()).toBe(1);
  });

  it("entrega el resumen hasta el JSON que recibe el navegador", async () => {
    // La pieza que faltaba cubrir: el servicio deriva bien, pero lo que el
    // navegador pinta es el JSON del mapeador HTTP. Si alguien quita los campos
    // ahí —o añade uno nuevo al resumen y olvida propagarlo— el frontend recibe
    // `undefined` y la tarjeta se queda muda sin que nada falle. Este test
    // recorre servicio → respuesta y mira las claves realmente emitidas.
    automationRepo.seed({ id: "f1", tenantId: "t1", key: "flow-1", name: "Flow", status: "draft", metadata: { createdAt: "x", updatedAt: "x" } });
    workspaceRepo.seed({
      tenantId: "t1", flowKey: "flow-1", updatedAt: "x", autosaveRevision: 0, publishedSnapshots: [],
      draft: {
        flow: { id: "f1", key: "flow-1", name: "Flow" },
        version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "inicio" },
        nodes: {
          inicio: { id: "inicio", type: "message", name: "Inicio", content: {}, config: {}, metadata: {} },
          suelto: { id: "suelto", type: "message", name: "Suelto", content: {}, config: {}, metadata: {} }
        },
        edgesBySource: {}
      }
    });

    const response = toAutomationListResponse(await sut.execute("t1"));

    expect(response.flows[0]).toMatchObject({ nodeCount: 2, connectionStatus: "disconnected" });
    expect(Object.keys(response.flows[0])).toEqual(expect.arrayContaining(["nodeCount", "connectionStatus"]));
  });

  it("proyecta cero y rojo cuando el workspace no existe", async () => {
    automationRepo.seed({ id: "f1", tenantId: "t1", key: "missing", name: "Flow", status: "draft", metadata: { createdAt: "x", updatedAt: "x" } });
    const result = await sut.execute("t1");
    expect(result.flows[0]?.graphSummary).toEqual({ nodeCount: 0, connectionStatus: "disconnected" });
    expect(workspaceRepo.count()).toBe(0);
  });

  it("da a cada automatización el resumen de su propio draft en una sola lectura", async () => {
    automationRepo.seed({ id: "f1", tenantId: "t1", key: "one", name: "Uno", status: "draft", metadata: { createdAt: "x", updatedAt: "x" } });
    automationRepo.seed({ id: "f2", tenantId: "t1", key: "two", name: "Dos", status: "draft", metadata: { createdAt: "x", updatedAt: "x" } });
    workspaceRepo.seed({
      tenantId: "t1", flowKey: "one", updatedAt: "x", autosaveRevision: 0, publishedSnapshots: [],
      draft: { flow: { id: "f1", key: "one", name: "Uno" }, version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "inicio" }, nodes: { inicio: { id: "inicio", type: "message", name: "Inicio", content: {}, config: {}, metadata: {} }, fin: { id: "fin", type: "end", name: "Fin", content: {}, config: {}, metadata: {} } }, edgesBySource: { inicio: [{ id: "e", fromNodeId: "inicio", toNodeId: "fin", priority: 0, isFallback: false, condition: { operator: "always" } }] } }
    });
    workspaceRepo.seed({
      tenantId: "t1", flowKey: "two", updatedAt: "x", autosaveRevision: 0, publishedSnapshots: [],
      draft: { flow: { id: "f2", key: "two", name: "Dos" }, version: { id: "v2", versionNumber: 1, status: "draft", entryNodeId: "inicio" }, nodes: { inicio: { id: "inicio", type: "message", name: "Inicio", content: {}, config: {}, metadata: {} }, suelto: { id: "suelto", type: "tags", name: "Suelto", content: {}, config: {}, metadata: {} } }, edgesBySource: {} }
    });

    const result = await sut.execute("t1");
    expect(result.flows.map(({ graphSummary }) => graphSummary)).toEqual([
      { nodeCount: 2, connectionStatus: "connected" },
      { nodeCount: 2, connectionStatus: "disconnected" }
    ]);
    expect(workspaceRepo.reads).toBe(1);
  });
});

describe("CreateFolderService", () => {
  let folderRepo: InMemoryFolderRepo;
  let sut: CreateFolderService;

  beforeEach(() => {
    folderRepo = new InMemoryFolderRepo();
    sut = new CreateFolderService(folderRepo);
  });

  it("creates a folder and returns it", async () => {
    const folder = await sut.execute("tenant-1", "Mi carpeta");
    expect(folder.name).toBe("Mi carpeta");
    expect(folder.tenantId).toBe("tenant-1");
    expect(folder.id).toBeTruthy();
    expect(folder.createdAt).toBeTruthy();
  });

  it("persists the folder in the repository", async () => {
    await sut.execute("tenant-1", "Carpeta persistida");
    const folders = await folderRepo.findByTenant("tenant-1");
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe("Carpeta persistida");
  });

  it("normaliza el nombre antes de persistir", async () => {
    const folder = await sut.execute("tenant-1", "   Mi carpeta   ");
    expect(folder.name).toBe("Mi carpeta");
  });

  it("rechaza un nombre vacío o en blanco sin persistir nada", async () => {
    for (const invalid of ["", "   ", "\t\n"]) {
      await expect(sut.execute("tenant-1", invalid)).rejects.toThrow(ValidationError);
    }

    expect(await folderRepo.findByTenant("tenant-1")).toHaveLength(0);
  });

  it("expone la invariante como error de dominio traducible a HTTP", async () => {
    await expect(sut.execute("tenant-1", "")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 422
    });
  });

  it("creates folder with parentFolderId", async () => {
    const folder = await sut.execute("tenant-1", "Subcarpeta", "parent-folder-id");
    expect(folder.parentFolderId).toBe("parent-folder-id");
  });

  it("generates unique ids for each folder", async () => {
    const a = await sut.execute("tenant-1", "A");
    const b = await sut.execute("tenant-1", "B");
    expect(a.id).not.toBe(b.id);
  });
});
