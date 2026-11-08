import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import { SimulateDraftService } from "../../../domains/automations/builder/application/SimulateDraftService";
import { UpgradingBuilderWorkspaceRepository } from "../../../domains/automations/builder/application/UpgradingBuilderWorkspaceRepository";
import { CreateAutomationService } from "../../../domains/automations/builder/application/CreateAutomationService";
import { DuplicateAutomationService } from "../../../domains/automations/builder/application/DuplicateAutomationService";
import { SetAutomationArchivedService } from "../../../domains/automations/catalog/application/SetAutomationArchivedService";
import { DeleteAutomationService } from "../../../domains/automations/builder/application/DeleteAutomationService";
import { RenameFolderService } from "../../../domains/automations/catalog/application/RenameFolderService";
import { MoveAutomationToFolderService } from "../../../domains/automations/catalog/application/MoveAutomationToFolderService";
import { ListAutomationsService } from "../../../domains/automations/catalog/application/ListAutomationsService";
import { CreateFolderService } from "../../../domains/automations/catalog/application/CreateFolderService";
import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { FolderRepository } from "../../../domains/automations/catalog/application/FolderRepository";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlAutomationRepository } from "../../../infrastructure/persistence/sql/SqlAutomationRepository";
import { SqlFolderRepository } from "../../../infrastructure/persistence/sql/SqlFolderRepository";
import { SqlBuilderWorkspaceRepository } from "../../../infrastructure/persistence/sql/SqlBuilderWorkspaceRepository";
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
  readonly simulateDraftService: SimulateDraftService;
  readonly deleteAutomationService: DeleteAutomationService;
  readonly createAutomationService: CreateAutomationService;
  readonly duplicateAutomationService: DuplicateAutomationService;
  readonly setAutomationArchivedService: SetAutomationArchivedService;
  readonly listAutomationsService: ListAutomationsService;
  readonly moveAutomationToFolderService: MoveAutomationToFolderService;
  readonly renameFolderService: RenameFolderService;
  readonly createFolderService: CreateFolderService;
  readonly automationRepository: AutomationRepository;
  readonly workspaceRepository: BuilderWorkspaceRepository;
}

interface AutomationsPersistence {
  readonly automationRepository: AutomationRepository;
  readonly folderRepository: FolderRepository;
  readonly workspaceRepository: BuilderWorkspaceRepository;
}

/**
 * El ÚNICO punto que elige dónde viven las automatizaciones (`AUTOMATIONS_STORE`).
 * Los casos de uso reciben los puertos y no saben cuál es.
 */
function composeAutomationsPersistence(config: ApiConfig, sqlClient: SqlClient): AutomationsPersistence {
  if (config.automationsStore === "sql") {
    return {
      automationRepository: new SqlAutomationRepository(sqlClient),
      folderRepository: new SqlFolderRepository(sqlClient),
      workspaceRepository: new SqlBuilderWorkspaceRepository(sqlClient)
    };
  }
  return {
    automationRepository: new JsonAutomationRepository(config.dataDirectory),
    folderRepository: new JsonFolderRepository(config.dataDirectory),
    workspaceRepository: new JsonBuilderWorkspaceRepository(config.dataDirectory)
  };
}

export function composeBuilderServices(config: ApiConfig, sqlClient: SqlClient): ApiServices {
  const persistence = composeAutomationsPersistence(config, sqlClient);
  // Toda lectura sale migrada al formato vigente (ver el decorador).
  const workspaceRepository = new UpgradingBuilderWorkspaceRepository(persistence.workspaceRepository);
  const { automationRepository, folderRepository } = persistence;

  return {
    getWorkspaceService: new GetBuilderWorkspaceService(
      workspaceRepository,
      buildInitialBuilderWorkspace,
      automationRepository
    ),
    saveDraftService: new SaveDraftService(workspaceRepository, automationRepository),
    simulateDraftService: new SimulateDraftService(
      new BuilderSimulationRuntimeFactory(composeNodeRuntime())
    ),
    deleteAutomationService: new DeleteAutomationService(automationRepository, workspaceRepository),
    createAutomationService: new CreateAutomationService(
      automationRepository,
      folderRepository,
      workspaceRepository,
      buildInitialBuilderWorkspace
    ),
    duplicateAutomationService: new DuplicateAutomationService(
      automationRepository,
      workspaceRepository,
      buildInitialBuilderWorkspace
    ),
    setAutomationArchivedService: new SetAutomationArchivedService(automationRepository),
    listAutomationsService: new ListAutomationsService(
      automationRepository,
      folderRepository,
      workspaceRepository
    ),
    renameFolderService: new RenameFolderService(folderRepository),
    moveAutomationToFolderService: new MoveAutomationToFolderService(
      automationRepository,
      folderRepository
    ),
    createFolderService: new CreateFolderService(folderRepository),
    automationRepository,
    workspaceRepository
  };
}
