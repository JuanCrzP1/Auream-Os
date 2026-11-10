import { useMemo } from "react";
import type { Connection, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import type { NodeType } from "@contracts/FlowSnapshot";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { useBuilderWorkspace } from "./useBuilderWorkspace";

type BuilderWorkspace = ReturnType<typeof useBuilderWorkspace>;

/** Las operaciones que cambian el grafo, tal como las recibe el lienzo. */
export interface BuilderMutations {
  readonly onNodesChange: OnNodesChange<CanvasNode>;
  readonly onEdgesChange: OnEdgesChange<CanvasEdge>;
  readonly onConnect: (connection: Connection) => void;
  readonly onDropNode: (type: NodeType, position: { x: number; y: number }) => void;
  readonly updateNode: (nodeId: string, patch: NodePatch) => void;
  readonly duplicateNode: (nodeId: string) => void;
  readonly removeNode: (nodeId: string) => void;
  readonly renameFlow: (name: string) => void;
}

const ignore = () => undefined;

/**
 * Solo lectura (sin `flows.write`, p. ej. el Asesor): el lienzo deja mirar,
 * seleccionar y medir los bloques, pero NINGUNA operación cambia el grafo
 * —ni arrastrar, ni conectar, ni borrar, ni soltar, ni renombrar—, así que el
 * autoguardado nunca tiene nada que escribir. La interfaz ya esconde esas
 * acciones; esto vuelve inofensiva cualquier ruta que se escape. La
 * protección real sigue en la API (403).
 */
export function useReadOnlyBuilder(builder: BuilderWorkspace, readOnly: boolean): BuilderMutations {
  const {
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleDropNode,
    handleUpdateNode,
    handleDuplicateNode,
    handleRemoveNode,
    handleRenameFlow
  } = builder;

  return useMemo<BuilderMutations>(
    () =>
      readOnly
        ? {
            // Seleccionar y medir no cambian el flujo; mover o borrar, sí.
            onNodesChange: (changes) => handleNodesChange(changes.filter((change) => change.type === "select" || change.type === "dimensions")),
            onEdgesChange: (changes) => handleEdgesChange(changes.filter((change) => change.type === "select")),
            onConnect: ignore,
            onDropNode: ignore,
            updateNode: ignore,
            duplicateNode: ignore,
            removeNode: ignore,
            renameFlow: ignore
          }
        : {
            onNodesChange: handleNodesChange,
            onEdgesChange: handleEdgesChange,
            onConnect: handleConnect,
            onDropNode: handleDropNode,
            updateNode: handleUpdateNode,
            duplicateNode: handleDuplicateNode,
            removeNode: handleRemoveNode,
            renameFlow: handleRenameFlow
          },
    [readOnly, handleNodesChange, handleEdgesChange, handleConnect, handleDropNode, handleUpdateNode, handleDuplicateNode, handleRemoveNode, handleRenameFlow]
  );
}
