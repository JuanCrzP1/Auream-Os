import { useAutosaveDraft } from "../useAutosaveDraft";
import { saveBuilderDraft } from "@features/automations/builder/services/saveBuilderDraft";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

interface UseBuilderAutosaveParams {
  flowKey: string;
  draft: BuilderFlowSnapshot | null;
  seedSignature: string | null;
  enabled: boolean;
  onSaved: (workspace: PersistedBuilderWorkspace) => void;
}

/**
 * useBuilderAutosave — responsabilidad única: autosave del draft del builder.
 *
 * Delega el mecanismo de debounce en useAutosaveDraft (genérico).
 * Solo conoce cómo persistir un draft de builder: llama a saveBuilderDraft.
 */
export function useBuilderAutosave({
  flowKey,
  draft,
  seedSignature,
  enabled,
  onSaved
}: UseBuilderAutosaveParams) {
  return useAutosaveDraft({
    draft,
    seedSignature,
    enabled,
    onSave: async (snapshot) => {
      const savedWorkspace = await saveBuilderDraft(flowKey, snapshot);
      onSaved(savedWorkspace);
    }
  });
}
