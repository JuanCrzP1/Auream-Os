import type { NodeType } from "./FlowSnapshot";
import { MENU_OUTPUT } from "./MenuConfig";

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
  "start",
  "message",
  "delay",
  "tags",
  "pixel",
  "record-sale",
  "set-field",
  "notification"
]);

/**
 * Bloques que DETIENEN la ejecución hasta un evento externo (respuesta del
 * cliente o paso del tiempo). Un ciclo que pasa por uno de ellos no es un
 * bucle infinito: cada vuelta espera. Ej.: «Otra respuesta» del Menú de vuelta
 * al mismo Menú.
 */
export const PAUSING_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>(["question", "menu", "delay"]);

/**
 * Salidas que pueden volver a su PROPIO bloque, como en Leona: «Otra
 * respuesta» del Menú vuelve a mostrar el menú cuando el cliente escribe algo
 * que no es una opción. Es la única: el Menú espera la respuesta en cada
 * vuelta, así que no es un bucle infinito (ver `PAUSING_NODE_TYPES`). Volver
 * al mismo bloque por cualquier otra salida se rechaza; «Tiempo agotado»
 * tampoco, porque reenviaría el menú sin fin a quien no contesta.
 */
const SELF_LOOP_OUTPUTS: Readonly<Partial<Record<NodeType, ReadonlyArray<string>>>> = {
  menu: [MENU_OUTPUT.other]
};

/** ¿Esa salida de ese bloque puede conectarse con el mismo bloque? */
export function canConnectToItself(nodeType: NodeType, output: string | null | undefined): boolean {
  return output != null && (SELF_LOOP_OUTPUTS[nodeType]?.includes(output) ?? false);
}

/** El bloque de entrada siempre tiene una sola salida, sea del tipo que sea. */
export const ENTRY_MAX_OUTGOING = 1;
