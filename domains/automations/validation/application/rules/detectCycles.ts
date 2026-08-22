import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Detecta ciclos infinitos mediante DFS desde el entry node.
 *
 * Un ciclo es ERROR solo si TODOS los edges del ciclo tienen operator='always'.
 * Ciclos con condiciones (eq, neq, exists) son válidos porque el EdgeEvaluator
 * puede salir de ellos dependiendo del input del usuario (ej: retry loops en questions).
 *
 * El set nodeIds se recibe como parámetro para evitar recrearlo en cada paso del DFS.
 */
export function detectCycles(
  snapshot: FlowSnapshot,
  entryNodeId: string,
  nodeIds: ReadonlySet<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    if (visited.has(nodeId)) return;

    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart);

      const allAlways = cycle.every((id) => {
        const edges = snapshot.edgesBySource[id] ?? [];
        return edges.length > 0 && edges.every((e) => e.condition.operator === "always");
      });

      if (allAlways) {
        issues.push({
          code: "INFINITE_CYCLE",
          message: `Ciclo infinito detectado: ${cycle.join(" → ")} → ${nodeId}. Todos los edges son 'always', el flujo nunca termina.`,
          nodeId
        });
      }
      return;
    }

    visiting.add(nodeId);

    const outgoing = snapshot.edgesBySource[nodeId] ?? [];
    for (const edge of outgoing) {
      if (nodeIds.has(edge.toNodeId)) {
        dfs(edge.toNodeId, [...path, nodeId]);
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  dfs(entryNodeId, []);
  return issues;
}
