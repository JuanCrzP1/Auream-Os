import { useCallback, useRef, useState } from "react";
import { applyNodeChanges, type OnNodesChange } from "@xyflow/react";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { duplicateNodeDraft } from "@features/automations/builder/services/duplicateNodeDraft";
import {
  applyNodePatch,
  type NodePatch
} from "@features/automations/builder/services/applyNodePatch";
import {
  isEntryNode,
  rejectEntryNodeRemoval
} from "@features/automations/builder/services/entryNodeProtection";
import {
  collapseAllNodes,
  toggleNodeExpansion
} from "@features/automations/builder/services/nodeExpansion";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";

/**
 * Gestiona el estado de los nodos del canvas y todas las operaciones sobre ellos.
 *
 * @param initialNodes  Nodos iniciales (solo se usa en el primer render).
 * @param selectedNodeId  ID del nodo actualmente seleccionado (manejado por useCanvasSelection).
 */
export function useCanvasNodes(initialNodes: CanvasNode[], selectedNodeId: string | null) {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);

  // Espejo de la lista para poder responder «¿se puede borrar?» de forma
  // síncrona sin que la respuesta dependa del render actual. Lo necesita el
  // coordinador, que compone el borrado de nodo con el de sus conexiones y
  // debe poder abortar las dos mitades a la vez; leer `nodes` directamente allí
  // haría que su callback cambiara de identidad en cada cambio del grafo y
  // volvería a renderizar el lienzo entero.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  /**
   * Todo cambio del lienzo pasa por aquí, incluidos los que React Flow emite
   * por su cuenta con la tecla Suprimir. Es el punto donde el borrado se
   * aplica, y por tanto el único sitio donde protegerlo tiene efecto.
   */
  const handleNodesChange: OnNodesChange<CanvasNode> = (changes) => {
    setNodes((current) =>
      applyNodeChanges<CanvasNode>(rejectEntryNodeRemoval(changes, current), current)
    );
  };

  /** `false` para el nodo de entrada: sostiene `entryNodeId` y no se borra. */
  const canRemoveNode = useCallback(
    (nodeId: string): boolean => !isEntryNode(nodesRef.current, nodeId),
    []
  );

  /**
   * Duplica un nodo con toda su configuración.
   *
   * El nodo de entrada NO se duplica: es único por definición —solo un nodo
   * puede ser `entryNodeId`— y una segunda copia sería un nodo que parece la
   * entrada sin serlo. Se apoya en la misma comprobación que impide borrarlo,
   * para que las dos protecciones no puedan divergir.
   *
   * Las conexiones no se copian: a dónde va la copia es una decisión del
   * usuario, y heredar las del original produciría dos ramas idénticas que casi
   * nunca es lo que se quiere.
   */
  const duplicateNode = useCallback((nodeId: string): void => {
    setNodes((current) => {
      const original = current.find((node) => node.id === nodeId);
      if (!original || original.data.isEntry) return current;

      return [...current, duplicateNodeDraft(original, current.length + 1)];
    });
  }, []);

  /** `false` para el nodo de entrada, por la misma razón que no se borra. */
  const canDuplicateNode = useCallback(
    (nodeId: string): boolean => !isEntryNode(nodesRef.current, nodeId),
    []
  );

  /**
   * Añade un nodo al canvas y devuelve su ID para que el coordinador
   * pueda seleccionarlo a continuación.
   */
  function addNode(nodeType: NodeType): string {
    const nextNode = createNodeDraft(nodeType, nodes.length + 1);
    setNodes((current) => [...current, nextNode]);
    return nextNode.id;
  }

  function dropNode(nodeType: NodeType, position: { x: number; y: number }): void {
    const nextNode: CanvasNode = { ...createNodeDraft(nodeType, nodes.length + 1), position };
    setNodes((current) => [...current, nextNode]);
  }

  /**
   * Elimina un nodo del canvas.
   *
   * Existe para que las tarjetas no tengan que tocar el estado por su cuenta:
   * antes `FlowNodeCard` llamaba a `useReactFlow().setNodes`, saltándose a este
   * hook, que es el dueño. Con dos escritores el estado tenía dos verdades y
   * cualquier historial futuro (deshacer, auditoría) se habría perdido los
   * borrados hechos por el camino corto.
   *
   * Estable a propósito: viaja por contexto hasta cada tarjeta y una identidad
   * nueva por render volvería a renderizar todo el lienzo en cada cambio.
   *
   * Las conexiones NO se tocan aquí: son de `useCanvasEdges`. Quien compone las
   * dos operaciones es el coordinador.
   */
  const removeNode = useCallback((nodeId: string): void => {
    setNodes((current) =>
      isEntryNode(current, nodeId) ? current : current.filter((node) => node.id !== nodeId)
    );
  }, []);

  /**
   * Único camino de escritura sobre un nodo.
   *
   * Toma el id explícito en lugar de operar sobre la selección: editar y
   * seleccionar son dos cosas distintas, y el editor ya sabe qué nodo abrió.
   *
   * Qué se puede cambiar y con qué semántica lo decide `applyNodePatch`. Aquí
   * solo se localiza el nodo y se sustituye por el resultado.
   */
  const updateNode = useCallback((nodeId: string, patch: NodePatch): void => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? applyNodePatch(node, patch) : node))
    );
  }, []);

  /**
   * Abre un nodo para configurarlo dentro del lienzo, y cierra el que hubiera.
   *
   * Estable: viaja por contexto hasta cada tarjeta, y una identidad nueva por
   * render volvería a renderizar todo el lienzo en cada cambio.
   */
  const toggleNodeExpanded = useCallback((nodeId: string): void => {
    setNodes((current) => toggleNodeExpansion(current, nodeId));
  }, []);

  /** Cierra el nodo abierto, sea cual sea. */
  const collapseNodes = useCallback((): void => {
    setNodes((current) => collapseAllNodes(current));
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return {
    nodes,
    setNodes,
    selectedNode,
    handleNodesChange,
    addNode,
    dropNode,
    removeNode,
    canRemoveNode,
    duplicateNode,
    canDuplicateNode,
    updateNode,
    toggleNodeExpanded,
    collapseNodes
  };
}
