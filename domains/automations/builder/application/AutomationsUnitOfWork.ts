import type { AutomationRepository } from "../../catalog/application/AutomationRepository";
import type { FolderRepository } from "../../catalog/application/FolderRepository";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";

// ---------------------------------------------------------------------------
// AutomationsUnitOfWork — puerto de transacción (FASE C3).
//
// Una operación que escribe en varios repositorios (crear: catálogo +
// borrador; guardar: borrador + nombre en el catálogo; borrar: los dos) se
// hace DENTRO de `run`: o se confirma todo, o nada. El dominio no sabe cómo:
// en SQL es una transacción real; en desarrollo con archivos, una ejecución
// directa (sin garantía, documentado).
// ---------------------------------------------------------------------------

export interface AutomationsRepositories {
  readonly automations: AutomationRepository;
  readonly folders: FolderRepository;
  readonly workspaces: BuilderWorkspaceRepository;
}

export interface AutomationsUnitOfWork {
  run<T>(work: (repositories: AutomationsRepositories) => Promise<T>): Promise<T>;
}

/**
 * Ejecuta `work` directamente sobre unos repositorios fijos, SIN transacción.
 * Para la persistencia en archivos (solo desarrollo) y para pruebas.
 */
export class DirectUnitOfWork implements AutomationsUnitOfWork {
  public constructor(private readonly repositories: AutomationsRepositories) {}

  public run<T>(work: (repositories: AutomationsRepositories) => Promise<T>): Promise<T> {
    return work(this.repositories);
  }
}
