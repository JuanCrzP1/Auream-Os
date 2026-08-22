import { useEffect, useRef, useState } from "react";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";

export function useAutosaveDraft(params: {
  draft: BuilderFlowSnapshot | null;
  seedSignature: string | null;
  enabled: boolean;
  onSave: (draft: BuilderFlowSnapshot) => Promise<void>;
}) {
  const { draft, seedSignature, enabled, onSave } = params;
  const lastSavedSignatureRef = useRef<string | null>(seedSignature);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Ref al último draft y firma para acceso en cleanup sin stale closure
  const pendingDraftRef = useRef<BuilderFlowSnapshot | null>(null);
  const pendingSignatureRef = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    lastSavedSignatureRef.current = seedSignature;
  }, [seedSignature]);

  useEffect(() => {
    if (!enabled || !draft) {
      return;
    }

    const currentSignature = JSON.stringify(draft);

    if (currentSignature === lastSavedSignatureRef.current) {
      pendingDraftRef.current = null;
      pendingSignatureRef.current = null;
      return;
    }

    // Registrar el draft pendiente para el caso de unmount antes del debounce
    pendingDraftRef.current = draft;
    pendingSignatureRef.current = currentSignature;

    const timeoutId = window.setTimeout(async () => {
      try {
        setStatus("saving");
        await onSaveRef.current(draft);
        lastSavedSignatureRef.current = currentSignature;
        pendingDraftRef.current = null;
        pendingSignatureRef.current = null;
        setStatus("saved");
      } catch (_error) {
        setStatus("error");
      }
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
      // Flush sincrónico al desmontar: si hay cambios pendientes, guardar sin esperar
      const flushDraft = pendingDraftRef.current;
      const flushSignature = pendingSignatureRef.current;
      if (flushDraft && flushSignature && flushSignature !== lastSavedSignatureRef.current) {
        lastSavedSignatureRef.current = flushSignature;
        pendingDraftRef.current = null;
        pendingSignatureRef.current = null;
        // Fire-and-forget: no podemos await en cleanup de useEffect
        void onSaveRef.current(flushDraft);
      }
    };
  }, [draft, enabled]);

  return status;
}