import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBuilderWorkspace } from "@features/automations/builder/services/fetchBuilderWorkspace";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

export interface BuilderLoaderState {
  workspace: PersistedBuilderWorkspace | null;
  loading: boolean;
  error: string | null;
  setWorkspace: (ws: PersistedBuilderWorkspace) => void;
  renameFlow: (name: string) => void;
}

/**
 * useBuilderLoader — responsabilidad única: poseer el estado del workspace.
 *
 * Gestiona el ciclo de vida del fetch (loading, error, resultado) y las
 * mutaciones locales sobre el workspace cargado.
 * No tiene conocimiento del canvas ni del autosave.
 */
export function useBuilderLoader(flowKey: string): BuilderLoaderState {
  const { activeTenantId } = useActiveTenant();
  const [workspace, setWorkspace] = useState<PersistedBuilderWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    fetchBuilderWorkspace(flowKey, activeTenantId ?? "")
      .then((result) => {
        if (mountedRef.current) {
          setWorkspace(result);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (mountedRef.current) {
          setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el workspace.");
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [flowKey, activeTenantId]);

  /**
   * Renombra el flow en el draft cargado.
   *
   * No llama a ninguna API propia: el nombre viaja en el snapshot del draft, y
   * el autosave que ya existe detecta el cambio y lo persiste por la misma vía
   * que cualquier otra edición del builder.
   */
  const renameFlow = useCallback((name: string) => {
    setWorkspace((current) =>
      current
        ? { ...current, draft: { ...current.draft, flow: { ...current.draft.flow, name } } }
        : current
    );
  }, []);

  return { workspace, loading, error, setWorkspace, renameFlow };
}
