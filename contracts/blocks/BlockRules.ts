import type { NodeType } from "../FlowSnapshot";

// ---------------------------------------------------------------------------
// Reglas de un bloque del flujo — la mitad que NO es visual: con qué nace,
// qué salidas ofrece según su configuración, si está listo para usarse y si
// cierra una rama. Las comparten el editor web (cada herramienta les suma lo
// visual), el servidor MCP (los agentes editan flujos con las MISMAS reglas) y
// cualquier otro editor futuro. Puras: sin React, sin red, sin Node.
// ---------------------------------------------------------------------------

/** Configuración o contenido de un bloque, tal como llega de disco, del editor o de un agente. */
export type BlockData = Readonly<Record<string, unknown>>;

/** Una salida con nombre de un bloque con varios caminos posibles. */
export interface BlockOutput {
  /** Identidad persistida como `fromOutput` en la conexión. Nunca se reutiliza. */
  readonly id: string;
  /** Rótulo visible junto al punto de conexión. */
  readonly label: string;
}

/** ¿Está el bloque listo para usarse? Si no, por qué (mensaje para el usuario). */
export interface BlockCheck {
  readonly valid: boolean;
  readonly reason: string | null;
}

export const VALID: BlockCheck = { valid: true, reason: null };

export function invalid(reason: string): BlockCheck {
  return { valid: false, reason };
}

export interface BlockRules {
  /** Tipo canónico del contrato compartido. */
  readonly type: NodeType;
  /** Nombre del bloque (en la paleta y como título de uno nuevo). */
  readonly label: string;
  /** Contenido con el que nace. */
  readonly defaultContent: BlockData;
  /** Configuración con la que nace. */
  readonly defaultConfig: BlockData;
  /** `false` para bloques de sistema (Inicio, Finalizar): existen en el modelo, no se ofrecen. */
  readonly availableInPalette: boolean;
  /** Cierra una rama: no exige conexiones salientes. */
  readonly terminal: boolean;
  /**
   * Salidas con nombre según la configuración. Ausente: UNA salida implícita
   * (la conexión no lleva `fromOutput`). Presente: exactamente estas (cero incluido).
   */
  readonly outputs?: (config: BlockData) => ReadonlyArray<BlockOutput>;
  /** ¿Está listo para usarse? Ausente: siempre. */
  readonly validate?: (content: BlockData, config: BlockData) => BlockCheck;
  /**
   * La configuración en su forma canónica (la que leen el motor y el editor):
   * valores por defecto, tipos correctos y sin campos desconocidos.
   */
  readonly normalizeConfig: (config: BlockData) => BlockData;
}
