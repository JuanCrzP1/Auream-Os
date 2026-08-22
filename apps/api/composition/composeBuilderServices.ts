import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { PublishDraftService } from "../../../domains/automations/builder/application/PublishDraftService";
import { RollbackDraftService } from "../../../domains/automations/builder/application/RollbackDraftService";
import { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import { SimulateDraftService } from "../../../domains/automations/builder/application/SimulateDraftService";
import { DeleteAutomationService } from "../../../domains/automations/builder/application/DeleteAutomationService";
import { ListAutomationsService } from "../../../domains/automations/catalog/application/ListAutomationsService";
import { GraphValidator } from "../../../domains/automations/validation/application/GraphValidator";
import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import { JsonAutomationRepository } from "../../../infrastructure/persistence/json/JsonAutomationRepository";
import { JsonBuilderWorkspaceRepository } from "../../../infrastructure/persistence/json/JsonBuilderWorkspaceRepository";
import { JsonFolderRepository } from "../../../infrastructure/persistence/json/JsonFolderRepository";
import { BuilderSimulationRuntimeFactory } from "./BuilderSimulationRuntimeFactory";
import { buildInitialBuilderWorkspace } from "./buildInitialBuilderWorkspace";
import { composeNodeRuntime } from "./composeNodeRuntime";
import type { ApiConfig } from "../config/loadApiConfig";

// ---------------------------------------------------------------------------
// composeBuilderServices
//
// Responsabilidad única: ensamblar los casos de uso de Automations con sus
// repositorios concretos.
//
// Es el único punto donde se elige la implementación de persistencia. Los
// dominios sólo conocen sus puertos, así que sustituir JSON por SQL se hace
// aquí sin tocar `domains/`.
// ---------------------------------------------------------------------------

export interface ApiServices {
  readonly getWorkspaceService: GetBuilderWorkspaceService;
  readonly saveDraftService: SaveDraftService;
  readonly publishDraftService: PublishDraftService;
  readonly rollbackDraftService: RollbackDraftService;
  readonly simulateDraftService: SimulateDraftService;
  readonly deleteAutomationService: DeleteAutomationService;
  readonly listAutomationsService: ListAutomationsService;
  readonly automationRepository: AutomationRepository;
}

export function composeBuilderServices(config: ApiConfig): ApiServices {
  const workspaceRepository = new JsonBuilderWorkspaceRepository(config.dataDirectory);
  const automationRepository = new JsonAutomationRepository(config.dataDirectory);
  const folderRepository = new JsonFolderRepository(config.dataDirectory);

  return {
    getWorkspaceService: new GetBuilderWorkspaceService(
      workspaceRepository,
      buildInitialBuilderWorkspace,
      automationRepository
    ),
    saveDraftService: new SaveDraftService(workspaceRepository),
    publishDraftService: new PublishDraftService(workspaceRepository, new GraphValidator()),
    rollbackDraftService: new RollbackDraftService(workspaceRepository),
    simulateDraftService: new SimulateDraftService(
      new BuilderSimulationRuntimeFactory(composeNodeRuntime())
    ),
    deleteAutomationService: new DeleteAutomationService(automationRepository, workspaceRepository),
    listAutomationsService: new ListAutomationsService(automationRepository, folderRepository),
    automationRepository
  };
}
