import { beforeEach, describe, expect, it } from "vitest";
import { CreateAutomationService, DEFAULT_AUTOMATION_NAME } from "../../domains/automations/builder/application/CreateAutomationService.js";
import { DuplicateAutomationService } from "../../domains/automations/builder/application/DuplicateAutomationService.js";
import { SetAutomationArchivedService } from "../../domains/automations/catalog/application/SetAutomationArchivedService.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import { DirectUnitOfWork } from "../../domains/automations/builder/application/AutomationsUnitOfWork.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { BuilderWorkspaceRepository } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";

// ---------------------------------------------------------------------------
// Crear, duplicar y archivar (B10). Todo con el tenant por delante: lo de otro
// tenant no se encuentra.
// ---------------------------------------------------------------------------

class Catalog implements AutomationRepository {
  items: AutomationFlow[] = [];
  async findByTenant(tenantId: string) { return this.items.filter((f) => f.tenantId === tenantId); }
  async findById(tenantId: string, id: string) { return this.items.find((f) => f.tenantId === tenantId && f.id === id); }
  async save(flow: AutomationFlow) {
    const i = this.items.findIndex((f) => f.tenantId === flow.tenantId && f.id === flow.id);
    if (i >= 0) this.items[i] = flow; else this.items.push(flow);
  }
  async delete(tenantId: string, id: string) { this.items = this.items.filter((f) => !(f.tenantId === tenantId && f.id === id)); }
}

class Folders implements FolderRepository {
  items: AutomationFolder[] = [];
  async findByTenant(tenantId: string) { return this.items.filter((f) => f.tenantId === tenantId); }
  async findById(tenantId: string, id: string) { return this.items.find((f) => f.tenantId === tenantId && f.id === id); }
  async save(folder: AutomationFolder) { this.items.push(folder); }
}

class Workspaces implements BuilderWorkspaceRepository {
  items = new Map<string, PersistedBuilderWorkspace>();
  async getWorkspace(tenantId: string, flowKey: string) { return this.items.get(`${tenantId}:${flowKey}`) ?? null; }
  async getWorkspaces() { return [...this.items.values()]; }
  async saveWorkspace(ws: PersistedBuilderWorkspace) { this.items.set(`${ws.tenantId}:${ws.flowKey}`, ws); }
  async deleteWorkspace(tenantId: string, flowKey: string) { this.items.delete(`${tenantId}:${flowKey}`); }
}

const T = "tenant-1";
let catalog: Catalog;
let folders: Folders;
let workspaces: Workspaces;

beforeEach(() => {
  catalog = new Catalog();
  folders = new Folders();
  workspaces = new Workspaces();
  folders.items.push({ id: "carpeta-1", tenantId: T, name: "Ventas", createdAt: "2026-01-01" });
  folders.items.push({ id: "carpeta-ajena", tenantId: "otro", name: "Ajena", createdAt: "2026-01-01" });
});

const uow = () => new DirectUnitOfWork({ automations: catalog, folders, workspaces });
const create = () => new CreateAutomationService(uow(), buildInitialBuilderWorkspace);

describe("CreateAutomationService", () => {
  it("crea la entrada del catálogo y el borrador inicial, con id del servidor", async () => {
    const flow = await create().execute(T);
    const ws = await workspaces.getWorkspace(T, flow.key);

    expect(flow).toMatchObject({ tenantId: T, name: DEFAULT_AUTOMATION_NAME, status: "draft" });
    expect(flow.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ws?.draft.flow.name).toBe(DEFAULT_AUTOMATION_NAME);
    expect(ws?.draft.nodes[ws.draft.version.entryNodeId]?.type).toBe("start");
  });

  it("con nombre y carpeta, nace con ese nombre dentro de la carpeta", async () => {
    const flow = await create().execute(T, { name: "  Bienvenida  ", folderId: "carpeta-1" });

    expect(flow.name).toBe("Bienvenida");
    expect(flow.folderId).toBe("carpeta-1");
    expect((await workspaces.getWorkspace(T, flow.key))?.draft.flow.name).toBe("Bienvenida");
  });

  it("rechaza una carpeta de otro tenant sin escribir nada", async () => {
    await expect(create().execute(T, { folderId: "carpeta-ajena" })).rejects.toBeInstanceOf(NotFoundError);
    expect(catalog.items).toHaveLength(0);
    expect(workspaces.items.size).toBe(0);
  });
});

describe("DuplicateAutomationService", () => {
  async function original() {
    const flow = await create().execute(T, { name: "Bienvenida", folderId: "carpeta-1" });
    const ws = (await workspaces.getWorkspace(T, flow.key))!;
    const startId = ws.draft.version.entryNodeId;
    await workspaces.saveWorkspace({
      ...ws,
      draft: {
        ...ws.draft,
        nodes: {
          ...ws.draft.nodes,
          hola: { id: "hola", type: "message", name: "Hola", content: {}, config: { items: [{ id: "t", kind: "text", text: "Hola" }] }, metadata: {} }
        },
        edgesBySource: { [startId]: [{ id: "e1", fromNodeId: startId, toNodeId: "hola", priority: 10, isFallback: false, condition: { operator: "always" } }] }
      },
      autosaveRevision: 7
    });
    return flow;
  }

  const duplicate = () => new DuplicateAutomationService(uow(), buildInitialBuilderWorkspace);

  it("copia el borrador completo con id y nombre nuevos, en la misma carpeta", async () => {
    const source = await original();
    const copy = await duplicate().execute(T, source.id);
    const copyWs = (await workspaces.getWorkspace(T, copy.key))!;
    const sourceWs = (await workspaces.getWorkspace(T, source.key))!;

    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({ name: "Bienvenida (copia)", folderId: "carpeta-1", status: "draft" });
    expect(copyWs.draft.nodes).toEqual(sourceWs.draft.nodes);
    expect(copyWs.draft.edgesBySource).toEqual(sourceWs.draft.edgesBySource);
    expect(copyWs.draft.flow).toEqual({ id: copy.id, key: copy.key, name: "Bienvenida (copia)" });
    expect(copyWs.autosaveRevision).toBe(0);
  });

  it("la copia es independiente: cambiarla no toca el original", async () => {
    const source = await original();
    const copy = await duplicate().execute(T, source.id);
    const copyWs = (await workspaces.getWorkspace(T, copy.key))!;
    (copyWs.draft.nodes.hola!.config as { items: Array<{ text: string }> }).items[0]!.text = "Cambiado";

    const sourceWs = (await workspaces.getWorkspace(T, source.key))!;
    expect((sourceWs.draft.nodes.hola!.config as { items: Array<{ text: string }> }).items[0]!.text).toBe("Hola");
  });

  it("una archivada se duplica como borrador", async () => {
    const source = await original();
    await new SetAutomationArchivedService(catalog).execute(T, source.id, true);

    expect((await duplicate().execute(T, source.id)).status).toBe("draft");
  });

  it("no encuentra una automatización de otro tenant", async () => {
    const source = await original();
    await expect(duplicate().execute("otro", source.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SetAutomationArchivedService", () => {
  it("archiva y restaura (como borrador)", async () => {
    const flow = await create().execute(T);
    const service = new SetAutomationArchivedService(catalog);

    expect((await service.execute(T, flow.id, true)).status).toBe("archived");
    expect((await service.execute(T, flow.id, false)).status).toBe("draft");
  });

  it("no escribe si ya está en el estado pedido", async () => {
    const flow = await create().execute(T);
    const before = (await catalog.findById(T, flow.id))!.metadata.updatedAt;

    await new SetAutomationArchivedService(catalog).execute(T, flow.id, false);
    expect((await catalog.findById(T, flow.id))!.metadata.updatedAt).toBe(before);
  });

  it("no encuentra una automatización de otro tenant", async () => {
    const flow = await create().execute(T);
    await expect(new SetAutomationArchivedService(catalog).execute("otro", flow.id, true)).rejects.toBeInstanceOf(NotFoundError);
  });
});
