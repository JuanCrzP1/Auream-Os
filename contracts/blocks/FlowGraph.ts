import type { BlockData } from "./BlockRules";

// ---------------------------------------------------------------------------
// La vista mínima de un flujo que necesitan las reglas de conexión y la
// revisión: bloques y conexiones, sin nada del lienzo ni del almacenamiento.
// El editor web la arma desde su lienzo; el servidor, desde el borrador.
// ---------------------------------------------------------------------------

export interface GraphNode {
  readonly id: string;
  readonly type: string;
  /** Nombre visible del bloque (para los mensajes). */
  readonly name: string;
  readonly content: BlockData;
  readonly config: BlockData;
  /** ¿Es el bloque de entrada del flujo? */
  readonly isEntry: boolean;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  /** Salida con nombre de la que arranca; `null`: la salida única. */
  readonly output: string | null;
}
