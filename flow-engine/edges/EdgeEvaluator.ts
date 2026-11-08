import type { FlowEdge } from "../../contracts/FlowSnapshot";
import type { NodeExecutionResult } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";

// ---------------------------------------------------------------------------
// EdgeEvaluator — decide por qué conexión sigue el flujo.
//
// DOS MODOS, según el bloque:
//
//   POR SALIDA (C14)   el bloque declara `execution.output` («true», «respuesta»,
//                      la opción del Menú…). Se sigue la conexión que arranca de
//                      esa salida. Si nadie la conectó, la rama TERMINA: es una
//                      decisión del usuario, no un error.
//   POR CONDICIONES    bloques de salida única (o flujos guardados antes de las
//                      salidas con nombre): condiciones de arista por prioridad
//                      y, si ninguna aplica, la de rescate (`isFallback`).
// ---------------------------------------------------------------------------

export type EdgeSelection =
  | { readonly kind: "edge"; readonly edge: FlowEdge }
  /** La salida declarada no tiene conexión: fin limpio de la rama. */
  | { readonly kind: "unconnected-output"; readonly output: string }
  /** Ninguna condición aplica y no hay rescate: el flujo no sabe seguir. */
  | { readonly kind: "no-match" };

export class EdgeEvaluator {
  public select(edges: ReadonlyArray<FlowEdge>, session: Session, execution: NodeExecutionResult): EdgeSelection {
    const ordered = [...edges].sort((left, right) => left.priority - right.priority);
    const hasNamedOutputs = ordered.some((edge) => edge.fromOutput !== undefined);

    // Por salida. Un flujo antiguo sin `fromOutput` en ninguna arista cae al
    // modo por condiciones para no quedarse sin camino.
    if (execution.output !== undefined && hasNamedOutputs) {
      const edge = ordered.find((candidate) => candidate.fromOutput === execution.output);
      return edge ? { kind: "edge", edge } : { kind: "unconnected-output", output: execution.output };
    }

    for (const edge of ordered) {
      if (!edge.isFallback && this.matches(edge, session, execution)) return { kind: "edge", edge };
    }

    const fallback = ordered.find((edge) => edge.isFallback);
    return fallback ? { kind: "edge", edge: fallback } : { kind: "no-match" };
  }

  private matches(edge: FlowEdge, session: Session, execution: NodeExecutionResult): boolean {
    const condition = edge.condition;

    if (condition.operator === "always") {
      return true;
    }

    if (!condition.fact) {
      return false;
    }

    const source = condition.fact.startsWith("node_result.")
      ? execution.nodeResult[condition.fact.replace("node_result.", "")]
      : session.context[condition.fact.replace("context.", "")];

    if (condition.operator === "exists") {
      return source !== undefined && source !== null && source !== "";
    }

    if (condition.operator === "eq") {
      return source === condition.value;
    }

    if (condition.operator === "neq") {
      return source !== condition.value;
    }

    return false;
  }
}
