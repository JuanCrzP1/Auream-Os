import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBuilderWorkspace } from "@features/automations/builder/services/fetchBuilderWorkspace";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

export interface BuilderLoaderState {
  workspace: PersistedBuilderWorkspace | null;
  loading: boolean;
  error: string | null;
  /**
   * Firma de lo último que el SERVIDOR confirmó.
   *
   * No es la del workspace: ese incluye además lo que el usuario lleva editado
   * y todavía no ha salido de aquí. Las dos cosas se separan porque el
   * autoguardado necesita saber qué hay al otro lado para decidir si hay algo
   * nuevo que mandar, y confundirlas hacía que un cambio local se diera por
   * guardado sin haberse enviado nunca.
   */
  serverSignature: string | null;
  /** Publica un workspace CONFIRMADO POR EL SERVIDOR: carga, guardado, publicación. */
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
  const [workspace, setWorkspaceState] = useState<PersistedBuilderWorkspace | null>(null);
  const [serverSignature, setServerSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  /**
   * Adopta un workspace que viene del servidor.
   *
   * Es el ÚNICO camino por el que avanza la firma confirmada: la carga inicial,
   * la respuesta de un guardado y la de publicar o revertir. Una edición local
   * —renombrar, mover un nodo— no pasa por aquí, y por eso no puede hacerse
   * pasar por guardada.
   */
  const setWorkspace = useCallback((ws: PersistedBuilderWorkspace) => {
    setWorkspaceState(ws);
    setServerSignature(JSON.stringify(ws.draft));
  }, []);

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
    setWorkspaceState((current) =>
      current
        ? { ...current, draft: { ...current.draft, flow: { ...current.draft.flow, name } } }
        : current
    );
  }, []);

  return { workspace, loading, error, serverSignature, setWorkspace, renameFlow };
}
