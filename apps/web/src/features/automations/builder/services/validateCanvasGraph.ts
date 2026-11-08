import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { PAUSING_NODE_TYPES } from "@contracts/FlowConnectionRules";
import { findTool } from "../tools/registry";
import { findOvercrowdedOutputs } from "./connectionRules";

export interface BuilderValidationReport {
  errors: string[];
  warnings: string[];
}

export function validateCanvasGraph(nodes: CanvasNode[], edges: CanvasEdge[]): BuilderValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entryNode = nodes.find((node) => node.data.isEntry);

  if (!entryNode) {
    errors.push("No existe entry node configurado.");
  }

  // Construir mapa de adyacencia para los nodos existentes
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  // Validar integridad de edges: source y target deben existir
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (!targets) {
      errors.push(`El edge ${edge.id} parte de un nodo que no existe.`);
      continue;
    }

    if (!adjacency.has(edge.target)) {
      // Severidad: ERROR. Un edge a un nodo borrado corrompe el flujo.
      errors.push(`El edge ${edge.id} apunta a un nodo que no existe.`);
      continue;
    }

    targets.push(edge.target);
  }

  // Nodos inalcanzables desde el entry (warning: el flujo puede funcionar sin ellos)
  if (entryNode) {
    const reachable = new Set<string>();
    const stack = [entryNode.id];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      for (const target of adjacency.get(current) ?? []) {
        stack.push(target);
      }
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`Nodo huérfano detectado: ${node.data.title}`);
      }
    }
  }

  // Validaciones por nodo
  for (const node of nodes) {
    const outgoing = edges.filter((edge) => edge.source === node.id);

    // Un flow guardado puede traer un tipo retirado en una versión anterior.
    // Se avisa aquí para que el usuario lo vea en el builder; el backend lo
    // rechaza al publicar con la regla UNKNOWN_NODE_TYPE.
    if (!findTool(node.data.nodeType)) {
      errors.push(`El bloque "${node.data.title}" usa un tipo no soportado en esta versión.`);
    }

    if (!node.data.isTerminal && outgoing.length === 0) {
      // Severidad: ERROR. Alineado con backend (GraphValidator). Un dead-end detiene el flujo.
      errors.push(`Camino muerto en "${node.data.title}" — no tiene edges salientes.`);
    }

  }

  // De cada salida sale como mucho una conexión (alineado con el backend,
  // validateOutgoingLimits).
  for (const sourceId of findOvercrowdedOutputs(edges)) {
    const node = nodes.find((candidate) => candidate.id === sourceId);
    if (node) errors.push(`"${node.data.title}" tiene más de una conexión saliendo de la misma salida.`);
  }

  // Ciclos: solo es un bucle infinito el que no pasa por ningún bloque que
  // espere (Esperar respuesta, Menú, Programador); esos se detienen en cada vuelta.
  const pauses = (nodeId: string): boolean => {
    const type = nodes.find((node) => node.id === nodeId)?.data.nodeType;
    return type !== undefined && PAUSING_NODE_TYPES.has(type);
  };

  const cycleVisited = new Set<string>();
  const cycleStack = new Set<string>();
  const path: string[] = [];

  const visit = (nodeId: string): boolean => {
    if (cycleStack.has(nodeId)) return !path.slice(path.indexOf(nodeId)).some(pauses);
    if (cycleVisited.has(nodeId)) return false;

    cycleVisited.add(nodeId);
    cycleStack.add(nodeId);
    path.push(nodeId);

    for (const target of adjacency.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }

    path.pop();
    cycleStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (visit(node.id)) {
      warnings.push(
        "Hay un ciclo que nunca se detiene: añade un bloque que espere (Esperar respuesta, Menú o Programador) o rompe el ciclo."
      );
      break;
    }
  }

  return { errors, warnings };
}
