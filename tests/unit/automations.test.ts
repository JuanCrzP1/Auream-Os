import { describe, it, expect, beforeEach } from "vitest";
import { ListAutomationsService } from "../../domains/automations/catalog/application/ListAutomationsService.js";
import { CreateFolderService } from "../../domains/automations/catalog/application/CreateFolderService.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";

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

// ---- Tests ----

describe("ListAutomationsService", () => {
  let automationRepo: InMemoryAutomationRepo;
  let folderRepo: InMemoryFolderRepo;
  let sut: ListAutomationsService;

  beforeEach(() => {
    automationRepo = new InMemoryAutomationRepo();
    folderRepo = new InMemoryFolderRepo();
    sut = new ListAutomationsService(automationRepo, folderRepo);
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
    expect(result.flows[0].id).toBe("f1");
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
