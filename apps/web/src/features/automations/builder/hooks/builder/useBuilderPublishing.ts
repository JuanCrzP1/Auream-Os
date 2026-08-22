import { publishBuilderWorkspace } from "@features/automations/builder/services/publishBuilderWorkspace";
import { rollbackBuilderWorkspace } from "@features/automations/builder/services/rollbackBuilderWorkspace";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

interface UseBuilderPublishingParams {
  flowKey: string;
  onUpdate: (workspace: PersistedBuilderWorkspace) => void;
}

/**
 * useBuilderPublishing — responsabilidad única: publicar y hacer rollback.
 *
 * No tiene conocimiento del canvas ni del autosave.
 * onUpdate es el único canal de salida: el coordinador decide qué hacer
 * con el workspace actualizado.
 */
export function useBuilderPublishing({ flowKey, onUpdate }: UseBuilderPublishingParams) {
  async function handlePublish(): Promise<void> {
    const nextWorkspace = await publishBuilderWorkspace(flowKey);
    onUpdate(nextWorkspace);
  }

  async function handleRollback(): Promise<void> {
    const nextWorkspace = await rollbackBuilderWorkspace(flowKey);
    onUpdate(nextWorkspace);
  }

  return { handlePublish, handleRollback };
}
