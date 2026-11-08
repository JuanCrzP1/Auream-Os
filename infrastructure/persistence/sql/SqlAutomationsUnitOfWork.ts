import type {
  AutomationsRepositories,
  AutomationsUnitOfWork
} from "../../../domains/automations/builder/application/AutomationsUnitOfWork";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { SqlClient } from "./SqlClient";
import { SqlAutomationRepository } from "./SqlAutomationRepository";
import { SqlFolderRepository } from "./SqlFolderRepository";
import { SqlBuilderWorkspaceRepository } from "./SqlBuilderWorkspaceRepository";

// ---------------------------------------------------------------------------
// SqlAutomationsUnitOfWork — transacción REAL de PostgreSQL (FASE C3).
//
// Cada `run` abre una transacción y entrega repositorios que escriben en ella:
// si `work` lanza, se hace rollback de todo. `decorateWorkspaces` aplica el
// mismo decorador de lectura que el resto de la API (migraciones de formato).
// ---------------------------------------------------------------------------

export class SqlAutomationsUnitOfWork implements AutomationsUnitOfWork {
  public constructor(
    private readonly sql: SqlClient,
    private readonly decorateWorkspaces: (inner: BuilderWorkspaceRepository) => BuilderWorkspaceRepository = (inner) => inner
  ) {}

  public run<T>(work: (repositories: AutomationsRepositories) => Promise<T>): Promise<T> {
    return this.sql.transaction((tx) =>
      work({
        automations: new SqlAutomationRepository(tx),
        folders: new SqlFolderRepository(tx),
        workspaces: this.decorateWorkspaces(new SqlBuilderWorkspaceRepository(tx))
      })
    );
  }
}
