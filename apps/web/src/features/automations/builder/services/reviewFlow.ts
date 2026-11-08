import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { PAUSING_NODE_TYPES } from "@contracts/FlowConnectionRules";
import { START_NODE_TYPE } from "@contracts/FlowEntry";
import { findTool } from "../tools/registry";
import { findOvercrowdedOutputs } from "./connectionRules";
import { listNodeOutputs } from "./nodeOutputs";

// ---------------------------------------------------------------------------
// Revisión del flujo: qué está mal o incompleto en el lienzo, bloque a bloque.
//
// Los flujos no se publican (se autoguardan), así que esto INFORMA, no
// bloquea nada. Gravedad:
//   error    el flujo no funcionará así (se detiene, se rompe o no arranca).
//   warning  funciona, pero probablemente no como esperas.
//
// Las reglas del grafo son las mismas que aplica el backend
// (`GraphValidator`); `tests/contract/graphValidationParity.test.ts` vigila
// que los dos den el mismo veredicto. Debe seguir siendo puro (sin React):
// ese test lo ejecuta en Node.
// ---------------------------------------------------------------------------

export type FlowIssueSeverity = "error" | "warning";

export type FlowIssueCode =
  | "no-entry"
  | "entry-not-start"
  | "extra-start"
  | "into-entry"
  | "broken-connection"
  | "unknown-tool"
  | "incomplete-config"
  | "dead-end"
  | "open-outputs"
  | "overcrowded-output"
  | "unreachable"
  | "endless-cycle";

export interface FlowIssue {
  /** Estable entre revisiones: sirve de `key` y para recordar qué se abrió. */
  readonly id: string;
  readonly severity: FlowIssueSeverity;
  readonly code: FlowIssueCode;
  readonly message: string;
  /** Bloque al que llevar al usuario, si el problema tiene uno. */
  readonly nodeId?: string;
}

export interface FlowReview {
  /** Errores primero; dentro de cada gravedad, en orden de detección. */
  readonly issues: ReadonlyArray<FlowIssue>;
  readonly errorCount: number;
  readonly warningCount: number;
}

const quote = (node: CanvasNode) => `«${node.data.title}»`;

export function reviewFlow(nodes: ReadonlyArray<CanvasNode>, edges: ReadonlyArray<CanvasEdge>): FlowReview {
  const issues: FlowIssue[] = [];
  const add = (severity: FlowIssueSeverity, code: FlowIssueCode, message: string, nodeId?: string, key = nodeId ?? "") =>
    issues.push({ id: `${code}:${key}`, severity, code, message, ...(nodeId ? { nodeId } : {}) });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const entry = nodes.find((node) => node.data.isEntry);

  // --- Inicio ---------------------------------------------------------------
  if (!entry) {
    add("error", "no-entry", "El flujo no tiene bloque de inicio.");
  } else {
    if (entry.data.nodeType !== START_NODE_TYPE) {
      add("error", "entry-not-start", "El flujo debe empezar en el bloque de inicio.", entry.id);
    }
    if (edges.some((edge) => edge.target === entry.id)) {
      add("error", "into-entry", "Ninguna conexión puede llegar al bloque de inicio.", entry.id);
    }
  }

  for (const node of nodes) {
    if (node.data.nodeType === START_NODE_TYPE && node !== entry) {
      add("error", "extra-start", `Solo puede haber un bloque de inicio: ${quote(node)} sobra.`, node.id);
    }
  }

  // --- Conexiones rotas -----------------------------------------------------
  const adjacency = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (!targets || !byId.has(edge.target)) {
      add("error", "broken-connection", "Hay una conexión hacia un bloque que ya no existe.", undefined, edge.id);
      continue;
    }
    targets.push(edge.target);
  }

  // --- Bloque a bloque ------------------------------------------------------
  for (const node of nodes) {
    const tool = findTool(node.data.nodeType);
    const outgoing = edges.filter((edge) => edge.source === node.id);

    if (!tool) {
      add("error", "unknown-tool", `${quote(node)} usa una herramienta que ya no existe. Reemplázalo.`, node.id);
      continue;
    }

    const config = tool.validate?.(node.data.content, node.data.config);
    if (config && !config.valid) {
      add("error", "incomplete-config", `${quote(node)}: ${config.reason}`, node.id);
    }

    if (!node.data.isTerminal && outgoing.length === 0) {
      // Alineado con el backend (validateNodeDegree).
      add("error", "dead-end", `${quote(node)} no continúa: conecta su salida al siguiente bloque.`, node.id);
      continue;
    }

    const outputs = listNodeOutputs(node.data.nodeType, node.data.config);
    if (outputs && outgoing.length > 0) {
      const used = new Set(outgoing.map((edge) => edge.sourceHandle ?? outputs[0]?.id));
      const open = outputs.filter((output) => !used.has(output.id)).map((output) => output.label);
      if (open.length > 0) {
        add(
          "warning",
          "open-outputs",
          `${quote(node)} tiene salidas sin conectar (${open.join(", ")}). Si el flujo sale por ahí, termina.`,
          node.id
        );
      }
    }
  }

  // De cada salida sale como mucho una conexión (validateOutgoingLimits).
  for (const sourceId of findOvercrowdedOutputs(edges)) {
    const node = byId.get(sourceId);
    if (node) add("error", "overcrowded-output", `${quote(node)} tiene dos conexiones saliendo de la misma salida.`, node.id);
  }

  // --- Alcance desde el inicio ----------------------------------------------
  if (entry) {
    const reached = new Set<string>();
    const stack = [entry.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (reached.has(current)) continue;
      reached.add(current);
      stack.push(...(adjacency.get(current) ?? []));
    }

    for (const node of nodes) {
      if (!reached.has(node.id)) {
        add("warning", "unreachable", `${quote(node)} está suelto: ningún camino desde el inicio llega a él.`, node.id);
      }
    }
  }

  // --- Ciclos ---------------------------------------------------------------
  // Solo es infinito el que no pasa por un bloque que espera (Esperar
  // respuesta, Menú, Programador): esos se detienen en cada vuelta.
  const pauses = (nodeId: string) => {
    const type = byId.get(nodeId)?.data.nodeType;
    return type !== undefined && PAUSING_NODE_TYPES.has(type);
  };
  const visited = new Set<string>();
  const onPath = new Set<string>();
  const path: string[] = [];

  const findEndlessCycle = (nodeId: string): string | null => {
    if (onPath.has(nodeId)) return path.slice(path.indexOf(nodeId)).some(pauses) ? null : nodeId;
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    onPath.add(nodeId);
    path.push(nodeId);
    for (const target of adjacency.get(nodeId) ?? []) {
      const found = findEndlessCycle(target);
      if (found) return found;
    }
    path.pop();
    onPath.delete(nodeId);
    return null;
  };

  for (const node of nodes) {
    const cycleAt = findEndlessCycle(node.id);
    if (cycleAt) {
      add(
        "warning",
        "endless-cycle",
        "Hay un ciclo que nunca se detiene: añade un bloque que espere (Esperar respuesta, Menú o Programador) o rómpelo.",
        cycleAt
      );
      break;
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { issues: [...errors, ...warnings], errorCount: errors.length, warningCount: warnings.length };
}
