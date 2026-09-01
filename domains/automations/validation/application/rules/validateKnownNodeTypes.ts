import type { FlowSnapshot, NodeType } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Tipos de nodo que el motor sabe ejecutar hoy.
 *
 * Debe coincidir con la unión `NodeType` y con los handlers registrados en
 * `composeNodeRuntime`. Se declara como valor —y no se deriva del tipo— porque
 * esta regla existe precisamente para datos que YA están persistidos y que el
 * compilador no puede comprobar: un snapshot guardado antes de que una
 * herramienta se retirara.
 */
const KNOWN_NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  "message",
  "question",
  "tags",
  "payment-proof",
  "condition",
  "distributor",
  "pixel",
  "ai",
  "delay",
  "sale-approved",
  "integration",
  "menu",
  "notification",
  "end"
]);

/**
 * Rechaza los nodos cuyo tipo el motor ya no sabe ejecutar.
 *
 * Sin esta regla, un flow con un tipo retirado se publica sin protesta y falla
 * en ejecución con `No existe handler para el nodo X` — lejos del builder y sin
 * forma de que el usuario entienda qué pasó. Aquí falla al publicar, señalando
 * el nodo exacto.
 */
export function validateKnownNodeTypes(snapshot: FlowSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [nodeId, node] of Object.entries(snapshot.nodes)) {
    if (!KNOWN_NODE_TYPES.has(node.type)) {
      issues.push({
        code: "UNKNOWN_NODE_TYPE",
        message: `El nodo '${nodeId}' usa el tipo '${node.type}', que esta versión de la plataforma ya no soporta. Reemplázalo por una herramienta disponible.`,
        nodeId
      });
    }
  }

  return issues;
}
