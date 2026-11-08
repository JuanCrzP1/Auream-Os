import type { NodeType } from "./FlowSnapshot";

// ---------------------------------------------------------------------------
// Reglas de conexión entre bloques, compartidas por el builder (al conectar y
// al validar el lienzo) y el backend (al validar antes de publicar).
//
// Modelo: cada bloque tiene SALIDAS; de cada salida sale como mucho UNA
// conexión, y a un bloque pueden llegar todas las que se quiera (salvo al de
// entrada, al que no llega ninguna). Ver docs/architecture/flow-connections.md.
// ---------------------------------------------------------------------------

/**
 * Bloques con una sola salida implícita: como mucho una conexión saliente.
 * Debe coincidir con las herramientas que no declaran `outputs()` en el
 * builder (lo vigila `tests/contract/toolRegistryParity.test.ts`).
 */
export const SINGLE_OUTPUT_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  "message",
  "delay",
  "tags",
  "pixel",
  "notification"
]);

/**
 * Bloques que DETIENEN la ejecución hasta un evento externo (respuesta del
 * cliente o paso del tiempo). Un ciclo que pasa por uno de ellos no es un
 * bucle infinito: cada vuelta espera. Ej.: «Otra respuesta» del Menú de vuelta
 * al mismo Menú.
 */
export const PAUSING_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(["question", "menu", "delay"]);

/** El bloque de entrada siempre tiene una sola salida, sea del tipo que sea. */
export const ENTRY_MAX_OUTGOING = 1;
