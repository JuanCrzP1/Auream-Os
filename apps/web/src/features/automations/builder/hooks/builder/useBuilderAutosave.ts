import { useDebouncedValue } from "../useDebouncedValue";
import { useDraftSync, type DraftSyncStatus } from "../useDraftSync";
import { saveBuilderDraft } from "@features/automations/builder/services/saveBuilderDraft";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

/** Estado del autoguardado tal y como lo muestra la topbar. */
export type AutosaveStatus = DraftSyncStatus;

/** Quietud tras la que se considera que el usuario terminó de editar. */
const AUTOSAVE_DELAY_MS = 900;

interface UseBuilderAutosaveParams {
  readonly flowKey: string;
  readonly draft: BuilderFlowSnapshot | null;
  readonly seedSignature: string | null;
  readonly enabled: boolean;
  readonly onSaved: (workspace: PersistedBuilderWorkspace) => void;
}

/**
 * useBuilderAutosave — autoguardado del borrador del builder.
 *
 * Es la composición de tres responsabilidades separadas, no la implementación
 * de ninguna:
 *
 *   useDebouncedValue  cuándo                (temporización)
 *   useDraftSync       qué y en qué orden    (política + estado real)
 *   saveBuilderDraft   por dónde             (transporte HTTP)
 *                      ↓
 *   SaveDraftService → BuilderWorkspaceRepository (puerto de persistencia)
 *
 * Lo único que este hook sabe de más es CÓMO se persiste un borrador de
 * builder. Nada más de la cadena le pertenece.
 */
export function useBuilderAutosave({
  flowKey,
  draft,
  seedSignature,
  enabled,
  onSaved
}: UseBuilderAutosaveParams): AutosaveStatus {
  const debouncedDraft = useDebouncedValue(draft, AUTOSAVE_DELAY_MS);

  return useDraftSync<BuilderFlowSnapshot>({
    draft,
    debouncedDraft,
    seedSignature,
    enabled,
    save: async (snapshot) => {
      const savedWorkspace = await saveBuilderDraft(flowKey, snapshot);
      onSaved(savedWorkspace);
    }
  });
}
