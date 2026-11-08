import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import { ensureStartEntry } from "../../../../contracts/FlowEntry";
import type { BuilderWorkspaceRepository, SaveWorkspaceOptions } from "./BuilderWorkspaceRepository";

// ---------------------------------------------------------------------------
// UpgradingBuilderWorkspaceRepository
//
// Decorador de lectura: todo workspace sale con el formato vigente, lo lea
// quien lo lea (builder, listado del Hub, renombrar…) y esté guardado donde
// esté (JSON hoy, SQL mañana). La escritura no se toca: el siguiente guardado
// deja el formato nuevo en disco.
//
// Migraciones activas:
//   - ensureStartEntry: los flujos anteriores al bloque `start` arrancaban en
//     un `message` (o en nada). Ver contracts/FlowEntry.ts.
//   - Sin historial de publicación: `publishedSnapshots` se descarta. Los
//     flujos ya no se publican (ROADMAP, B6).
//
// Una migración nueva se añade en `upgradeWorkspace`, nunca en un caso de uso.
// ---------------------------------------------------------------------------

/** Campos de formatos anteriores que ya no forman parte del contrato. */
interface LegacyWorkspaceFields {
  readonly publishedSnapshots?: unknown;
}

export function upgradeWorkspace(stored: PersistedBuilderWorkspace): PersistedBuilderWorkspace {
  const { publishedSnapshots, ...workspace } = stored as PersistedBuilderWorkspace & LegacyWorkspaceFields;
  const draft = ensureStartEntry(workspace.draft);

  if (publishedSnapshots === undefined && draft === workspace.draft) return stored;
  return { ...workspace, draft };
}

export class UpgradingBuilderWorkspaceRepository implements BuilderWorkspaceRepository {
  public constructor(private readonly inner: BuilderWorkspaceRepository) {}

  public async getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null> {
    const workspace = await this.inner.getWorkspace(tenantId, flowKey);
    return workspace ? upgradeWorkspace(workspace) : null;
  }

  public async getWorkspaces(tenantId: string, flowKeys: readonly string[]): Promise<PersistedBuilderWorkspace[]> {
    return (await this.inner.getWorkspaces(tenantId, flowKeys)).map(upgradeWorkspace);
  }

  public saveWorkspace(workspace: PersistedBuilderWorkspace, options?: SaveWorkspaceOptions): Promise<void> {
    return this.inner.saveWorkspace(workspace, options);
  }

  public deleteWorkspace(tenantId: string, flowKey: string): Promise<void> {
    return this.inner.deleteWorkspace(tenantId, flowKey);
  }
}
