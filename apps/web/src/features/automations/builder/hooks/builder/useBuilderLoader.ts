import { useEffect, useRef, useState } from "react";
import { fetchBuilderWorkspace } from "@features/automations/builder/services/fetchBuilderWorkspace";
import { useAuthSession } from "@shared/auth/context/AuthContext";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

export interface BuilderLoaderState {
  workspace: PersistedBuilderWorkspace | null;
  loading: boolean;
  error: string | null;
  setWorkspace: (ws: PersistedBuilderWorkspace) => void;
}

/**
 * useBuilderLoader — responsabilidad única: carga inicial del workspace.
 *
 * Gestiona el ciclo de vida del fetch: loading, error, resultado.
 * No tiene conocimiento del canvas ni del autosave.
 */
export function useBuilderLoader(flowKey: string): BuilderLoaderState {
  const { tenantId } = useAuthSession();
  const [workspace, setWorkspace] = useState<PersistedBuilderWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    fetchBuilderWorkspace(flowKey, tenantId)
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
  }, [flowKey, tenantId]);

  return { workspace, loading, error, setWorkspace };
}
