import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";

/**
 * Opciones de guardado. `expectedRevision`: bloqueo optimista (FASE C4). Si
 * se indica y la revisión guardada ya no es esa, el guardado NO ocurre y se
 * lanza `ConflictError`. Comprobar y escribir es una sola operación atómica.
 */
export interface SaveWorkspaceOptions {
  readonly expectedRevision?: number;
}

export interface BuilderWorkspaceRepository {
  getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null>;
  /** Lectura sin efectos secundarios para proyecciones de listado. */
  getWorkspaces(tenantId: string, flowKeys: readonly string[]): Promise<PersistedBuilderWorkspace[]>;
  saveWorkspace(workspace: PersistedBuilderWorkspace, options?: SaveWorkspaceOptions): Promise<void>;
  deleteWorkspace(tenantId: string, flowKey: string): Promise<void>;
}
