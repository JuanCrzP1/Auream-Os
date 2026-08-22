import type { CanvasEdge, CanvasNode } from "../types/canvas";

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

    if (!node.data.isTerminal && outgoing.length === 0) {
      // Severidad: ERROR. Alineado con backend (GraphValidator). Un dead-end detiene el flujo.
      errors.push(`Camino muerto en "${node.data.title}" — no tiene edges salientes.`);
    }

    if (node.data.nodeType === "question" && !outgoing.some((edge) => edge.data?.isFallback)) {
      // Severidad: ERROR. Alineado con backend. Sin fallback el flujo falla en runtime.
      errors.push(`La pregunta "${node.data.title}" no tiene un edge de fallback.`);
    }
  }

  // Detección de ciclos (warning: los ciclos condicionales son válidos en runtime)
  const cycleVisited = new Set<string>();
  const cycleStack = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (cycleStack.has(nodeId)) return true;
    if (cycleVisited.has(nodeId)) return false;

    cycleVisited.add(nodeId);
    cycleStack.add(nodeId);

    for (const target of adjacency.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }

    cycleStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (visit(node.id)) {
      warnings.push("Se detectó un loop potencial. Revisa condiciones de salida.");
      break;
    }
  }

  return { errors, warnings };
}
