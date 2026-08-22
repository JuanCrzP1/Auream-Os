import { useState } from "react";
import { applyNodeChanges, type OnNodesChange } from "@xyflow/react";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
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

  const handleNodesChange: OnNodesChange<CanvasNode> = (changes) => {
    setNodes((current) => applyNodeChanges<CanvasNode>(changes, current));
  };

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

  function updateSelectedNode(field: "title" | "preview", value: string): void {
    if (!selectedNodeId) return;

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNodeId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            title: field === "title" ? value : node.data.title,
            preview: field === "preview" ? value : node.data.preview,
            content: {
              ...node.data.content,
              text: field === "preview" ? value : node.data.content.text
            }
          }
        };
      })
    );
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return {
    nodes,
    setNodes,
    selectedNode,
    handleNodesChange,
    addNode,
    dropNode,
    updateSelectedNode
  };
}
