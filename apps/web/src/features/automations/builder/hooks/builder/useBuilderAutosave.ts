import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "../useDebouncedValue";
import { useDraftSync, type DraftSyncStatus } from "../useDraftSync";
import { saveBuilderDraft } from "@features/automations/builder/services/saveBuilderDraft";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { RequestError } from "@shared/http/RequestError";

/**
 * Estado del autoguardado tal y como lo muestra la topbar. `conflict`: el
 * servidor tiene una versión más nueva (otra pestaña u otra persona); se deja
 * de guardar hasta recargar, para no pisar ese trabajo (C4).
 */
export type AutosaveStatus = DraftSyncStatus | "conflict";

/** Quietud tras la que se considera que el usuario terminó de editar. */
const AUTOSAVE_DELAY_MS = 900;

interface UseBuilderAutosaveParams {
  readonly flowKey: string;
  readonly draft: BuilderFlowSnapshot | null;
  readonly seedSignature: string | null;
  /** Revisión del workspace que confirmó el servidor al cargar. */
  readonly seedRevision: number | null;
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
  seedRevision,
  enabled,
  onSaved
}: UseBuilderAutosaveParams): AutosaveStatus {
  const debouncedDraft = useDebouncedValue(draft, AUTOSAVE_DELAY_MS);
  const [conflict, setConflict] = useState(false);

  // La revisión sobre la que se edita. Vive en una ref y se actualiza en el
  // MISMO instante en que responde el servidor: un guardado encolado sale justo
  // después, antes de que React vuelva a renderizar, y no puede llevar una vieja.
  const revisionRef = useRef<number | null>(seedRevision);
  useEffect(() => {
    revisionRef.current = seedRevision;
  }, [seedRevision]);

  const status = useDraftSync<BuilderFlowSnapshot>({
    draft,
    debouncedDraft,
    seedSignature,
    enabled: enabled && !conflict,
    save: async (snapshot) => {
      try {
        const savedWorkspace = await saveBuilderDraft(flowKey, snapshot, revisionRef.current ?? 0);
        revisionRef.current = savedWorkspace.autosaveRevision;
        onSaved(savedWorkspace);
      } catch (error) {
        if (error instanceof RequestError && error.status === 409) setConflict(true);
        throw error;
      }
    }
  });

  return conflict ? "conflict" : status;
}
