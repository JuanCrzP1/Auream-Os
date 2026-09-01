import { createContext, useContext, useMemo, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Frontera de edición del builder.
//
// Las tarjetas del canvas las instancia React Flow, no nosotros: no hay forma
// de pasarles props desde `BuilderPage`. Antes eso se resolvía con una variable
// mutable de módulo (`editCallbackStore`), que era estado global implícito: una
// sola instancia del builder por proceso, imposible de aislar en un test y con
// el ciclo de vida desacoplado del árbol de React.
//
// Este contexto ocupa ese hueco con el mecanismo que React ya ofrece para
// exactamente esto. Al vivir en el árbol, dos builders montados a la vez tienen
// cada uno sus operaciones.
//
// Lo que este contexto ES: un canal de operaciones.
// Lo que NO es: un store. No guarda estado, no guarda datos de tenant, no
// guarda nada de persistencia y no ejecuta lógica del motor. El dueño del
// estado del canvas sigue siendo `useCanvasNodes` / `useCanvasEdges`.
// ---------------------------------------------------------------------------

/** Operaciones que una tarjeta del canvas puede solicitar sobre el grafo. */
export interface BuilderEditingOperations {
  /** Abre el editor del nodo. Quién lo abre y cómo lo decide el consumidor. */
  readonly requestEdit: (nodeId: string) => void;
  /** Elimina el nodo y las conexiones que lo tocan. */
  readonly removeNode: (nodeId: string) => void;
}

const BuilderEditingContext = createContext<BuilderEditingOperations | null>(null);

interface BuilderEditingProviderProps extends BuilderEditingOperations {
  readonly children: ReactNode;
}

/**
 * Publica las operaciones de edición al subárbol del builder.
 *
 * Las dos operaciones deben ser referencias estables (`useCallback` o setters
 * de `useState`): el valor del contexto se memoiza sobre ellas, y si cambiasen
 * en cada render se re-renderizarían todas las tarjetas del canvas en cada
 * cambio, que es justo lo que un flujo grande no puede permitirse.
 */
export function BuilderEditingProvider({
  requestEdit,
  removeNode,
  children
}: BuilderEditingProviderProps) {
  const operations = useMemo<BuilderEditingOperations>(
    () => ({ requestEdit, removeNode }),
    [requestEdit, removeNode]
  );

  return (
    <BuilderEditingContext.Provider value={operations}>{children}</BuilderEditingContext.Provider>
  );
}

/**
 * Operaciones de edición para un componente del canvas.
 *
 * Falla si se usa fuera del provider en lugar de degradar en silencio: un nodo
 * cuyo botón de borrar no hace nada es peor que un error explícito en
 * desarrollo.
 */
export function useBuilderEditing(): BuilderEditingOperations {
  const operations = useContext(BuilderEditingContext);

  if (!operations) {
    throw new Error(
      "useBuilderEditing debe usarse dentro de <BuilderEditingProvider>. " +
        "Las tarjetas del canvas se montan bajo el provider que declara BuilderPage."
    );
  }

  return operations;
}
