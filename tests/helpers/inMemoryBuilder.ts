import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { BuilderWorkspaceRepository, SaveWorkspaceOptions } from "../../domains/automations/builder/application/BuilderWorkspaceRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";
import { DirectUnitOfWork } from "../../domains/automations/builder/application/AutomationsUnitOfWork.js";
import { CreateAutomationService } from "../../domains/automations/builder/application/CreateAutomationService.js";
import { GetBuilderWorkspaceService } from "../../domains/automations/builder/application/GetBuilderWorkspaceService.js";
import { SaveDraftService } from "../../domains/automations/builder/application/SaveDraftService.js";
import { ListAutomationsService } from "../../domains/automations/catalog/application/ListAutomationsService.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import type { FlowEditingBuilderServices } from "../../apps/api/composition/composeFlowEditingService.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";

// Los casos de uso REALES del builder (crear, leer, guardar, listar) sobre
// repositorios en memoria, con el bloqueo optimista de verdad: guardar sobre
// una revisión vieja lanza `ConflictError`, como en Neon.

class Catalog implements AutomationRepository {
  public items: AutomationFlow[] = [];
  public async findByTenant(tenantId: string) { return this.items.filter((flow) => flow.tenantId === tenantId); }
  public async findById(tenantId: string, id: string) { return this.items.find((flow) => flow.tenantId === tenantId && flow.id === id); }
  public async save(flow: AutomationFlow) {
    const index = this.items.findIndex((item) => item.tenantId === flow.tenantId && item.id === flow.id);
    if (index >= 0) this.items[index] = flow;
    else this.items.push(flow);
  }
  public async delete(tenantId: string, id: string) { this.items = this.items.filter((flow) => !(flow.tenantId === tenantId && flow.id === id)); }
}

class Folders implements FolderRepository {
  public items: AutomationFolder[] = [];
  public async findByTenant(tenantId: string) { return this.items.filter((folder) => folder.tenantId === tenantId); }
  public async findById(tenantId: string, id: string) { return this.items.find((folder) => folder.tenantId === tenantId && folder.id === id); }
  public async save(folder: AutomationFolder) { this.items.push(folder); }
}

export class InMemoryWorkspaces implements BuilderWorkspaceRepository {
  public readonly items = new Map<string, PersistedBuilderWorkspace>();
  public async getWorkspace(tenantId: string, flowKey: string) { return this.items.get(`${tenantId}:${flowKey}`) ?? null; }
  public async getWorkspaces(tenantId: string, flowKeys: readonly string[]) { return flowKeys.map((key) => this.items.get(`${tenantId}:${key}`)).filter((item): item is PersistedBuilderWorkspace => Boolean(item)); }
  public async saveWorkspace(workspace: PersistedBuilderWorkspace, options: SaveWorkspaceOptions = {}) {
    const current = this.items.get(`${workspace.tenantId}:${workspace.flowKey}`);
    if (options.expectedRevision !== undefined && current && current.autosaveRevision !== options.expectedRevision) throw new ConflictError("El borrador cambió.");
    this.items.set(`${workspace.tenantId}:${workspace.flowKey}`, workspace);
  }
  public async deleteWorkspace(tenantId: string, flowKey: string) { this.items.delete(`${tenantId}:${flowKey}`); }
}

export function createInMemoryBuilder(): { services: FlowEditingBuilderServices; workspaces: InMemoryWorkspaces; catalog: Catalog } {
  const catalog = new Catalog();
  const folders = new Folders();
  const workspaces = new InMemoryWorkspaces();
  const unitOfWork = new DirectUnitOfWork({ automations: catalog, folders, workspaces });
  return {
    catalog,
    workspaces,
    services: {
      listAutomationsService: new ListAutomationsService(catalog, folders, workspaces),
      getWorkspaceService: new GetBuilderWorkspaceService(workspaces, buildInitialBuilderWorkspace, catalog),
      saveDraftService: new SaveDraftService(unitOfWork),
      createAutomationService: new CreateAutomationService(unitOfWork, buildInitialBuilderWorkspace)
    }
  };
}
