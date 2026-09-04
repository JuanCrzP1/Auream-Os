import { useCallback } from "react";
import { useNodes } from "@xyflow/react";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import { findExpandedNodeId } from "@features/automations/builder/services/nodeExpansion";
import { useBuilderEditing } from "@features/automations/builder/context/BuilderEditingContext";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { NodeExpandedFrame } from "./NodeExpandedFrame";

/**
 * Ventana de edición de un nodo, INDEPENDIENTE del lienzo.
 *
 * NO pertenece al sistema de coordenadas de React Flow. No usa
 * `ViewportPortal`, no usa `useInternalNode`, no lee `position` ni
 * `positionAbsolute` de ningún nodo. Es deliberado: un panel de edición no es
 * parte del dibujo del flujo, es una capa de interfaz del Builder que se
 * abre encima de él — como cualquier panel modal, no como una etiqueta que
 * sigue a un nodo.
 *
 * Se ancla al `viewport` REAL del navegador con `position: fixed`, centrada.
 * Eso exige que ningún antepasado en el árbol de DOM tenga `transform`
 * —`.react-flow__viewport` sí lo tiene, para el pan/zoom—, así que este
 * componente se monta como HERMANO de `<ReactFlow>`, nunca como hijo suyo:
 * dentro habría heredado ese `transform` y el `fixed` habría dejado de
 * anclarse al navegador para anclarse al lienzo transformado, que es
 * exactamente el defecto que esto corrige.
 *
 * Sigue leyendo qué nodo está abierto —`useNodes` + `findExpandedNodeId`,
 * ya existentes— porque eso es DATO del nodo (su título, su configuración),
 * no su GEOMETRÍA. Lo primero le pertenece a la ventana; lo segundo, no.
 *
 * GENÉRICO A PROPÓSITO: la única pregunta que hace es «¿hay un nodo con
 * `isExpanded` y su herramienta declara `Editor`?» — la misma que ya hacía
 * `FlowNodeCard`. Ningún `if` por tipo de herramienta.
 */
export function ExpandedNodeOverlay() {
  const nodes = useNodes<CanvasNode>();
  const { toggleExpand, updateNode } = useBuilderEditing();

  const expandedId = findExpandedNodeId(nodes);
  const expandedNode = expandedId ? nodes.find((node) => node.id === expandedId) : undefined;

  // Se invoca al confirmar, no al teclear: el editor acumula sus cambios y solo
  // al pulsar «Guardar» bajan al nodo. A partir de ahí el autoguardado del
  // lienzo los persiste como cualquier otro cambio del grafo — no hay una
  // segunda persistencia, ni este camino la conoce.
  const handleCommit = useCallback(
    (patch: NodePatch) => { if (expandedId) updateNode(expandedId, patch); },
    [expandedId, updateNode]
  );

  const handleClose = useCallback(
    () => { if (expandedId) toggleExpand(expandedId); },
    [expandedId, toggleExpand]
  );

  if (!expandedNode) return null;

  const tool = resolveTool(expandedNode.data.nodeType);
  const ui = resolveToolUi(expandedNode.data.nodeType);
  // Sin editor propio no hay nada que mostrar: la tarjeta compacta ya es toda
  // la configuración que esa herramienta ofrece hoy.
  if (!ui.Editor) return null;

  return (
    <div className="node-expanded-overlay">
      <NodeExpandedFrame
        data={expandedNode.data}
        tool={tool}
        ui={ui}
        onCommit={handleCommit}
        onClose={handleClose}
      />
    </div>
  );
}
