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
import { SqlAutomationsUnitOfWork } from "../../../infrastructure/persistence/sql/SqlAutomationsUnitOfWork";
import { DirectUnitOfWork, type AutomationsUnitOfWork } from "../../../domains/automations/builder/application/AutomationsUnitOfWork";
import { JsonAutomationRepository } from "../../../infrastructure/persistence/json/JsonAutomationRepository";
import { JsonBuilderWorkspaceRepository } from "../../../infrastructure/persistence/json/JsonBuilderWorkspaceRepository";
import { JsonFolderRepository } from "../../../infrastructure/persistence/json/JsonFolderRepository";
import { BuilderSimulationRuntimeFactory } from "./BuilderSimulationRuntimeFactory";
import { buildInitialBuilderWorkspace } from "./buildInitialBuilderWorkspace";
import { SafeHttpRequester } from "../../../infrastructure/http/SafeHttpRequester";
import { InMemoryRateLimiter } from "../../../platform/security/rate-limiting/application/InMemoryRateLimiter";
import { TestIntegrationRequestService } from "../../../domains/automations/builder/application/TestIntegrationRequestService";
import { EngineIntegrationRequestTester } from "./EngineIntegrationRequestTester";
import { composeNodeRuntime, simulationDependencies } from "./composeNodeRuntime";
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
  readonly testIntegrationService: TestIntegrationRequestService;
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
  /** Ya envuelto en el decorador de lectura (migraciones de formato). */
  readonly workspaceRepository: BuilderWorkspaceRepository;
  /** Escrituras en varios repositorios: transacción real en SQL (C3). */
  readonly unitOfWork: AutomationsUnitOfWork;
}

/** Toda lectura de un borrador sale migrada al formato vigente. */
const upgrading = (inner: BuilderWorkspaceRepository): BuilderWorkspaceRepository =>
  new UpgradingBuilderWorkspaceRepository(inner);

/**
 * El ÚNICO punto que elige dónde viven las automatizaciones (`AUTOMATIONS_STORE`).
 * Los casos de uso reciben los puertos y no saben cuál es.
 */
function composeAutomationsPersistence(config: ApiConfig, sqlClient: SqlClient): AutomationsPersistence {
  if (config.automationsStore === "sql") {
    return {
      automationRepository: new SqlAutomationRepository(sqlClient),
      folderRepository: new SqlFolderRepository(sqlClient),
      workspaceRepository: upgrading(new SqlBuilderWorkspaceRepository(sqlClient)),
      unitOfWork: new SqlAutomationsUnitOfWork(sqlClient, upgrading)
    };
  }
  // Archivos: solo desarrollo. Sin transacciones (documentado en DirectUnitOfWork).
  const repositories = {
    automations: new JsonAutomationRepository(config.dataDirectory),
    folders: new JsonFolderRepository(config.dataDirectory),
    workspaces: upgrading(new JsonBuilderWorkspaceRepository(config.dataDirectory))
  };
  return {
    automationRepository: repositories.automations,
    folderRepository: repositories.folders,
    workspaceRepository: repositories.workspaces,
    unitOfWork: new DirectUnitOfWork(repositories)
  };
}

export function composeBuilderServices(config: ApiConfig, sqlClient: SqlClient): ApiServices {
  const { automationRepository, folderRepository, workspaceRepository, unitOfWork } =
    composeAutomationsPersistence(config, sqlClient);
  // Un único cliente HTTP protegido (SSRF, plazos, tamaños) para la simulación
  // y para «Probar» del bloque Integración.
  const http = new SafeHttpRequester({ allowPrivateNetworks: config.integrationsAllowPrivateNetwork });

  return {
    getWorkspaceService: new GetBuilderWorkspaceService(
      workspaceRepository,
      buildInitialBuilderWorkspace,
      automationRepository
    ),
    saveDraftService: new SaveDraftService(unitOfWork),
    simulateDraftService: new SimulateDraftService(
      new BuilderSimulationRuntimeFactory(composeNodeRuntime(simulationDependencies({ http })), config.defaultTimezone)
    ),
    testIntegrationService: new TestIntegrationRequestService(new EngineIntegrationRequestTester(http), new InMemoryRateLimiter()),
    deleteAutomationService: new DeleteAutomationService(unitOfWork),
    createAutomationService: new CreateAutomationService(unitOfWork, buildInitialBuilderWorkspace),
    duplicateAutomationService: new DuplicateAutomationService(unitOfWork, buildInitialBuilderWorkspace),
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
