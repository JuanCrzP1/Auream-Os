import type { NodeType } from "@contracts/FlowSnapshot";

/**
 * Mitad PURA del contrato de una herramienta: todo lo que el builder necesita
 * para ofrecer, resumir, validar y conectar un tipo de nodo.
 *
 * Sin React ni JSX: este módulo lo carga también el test de paridad del
 * backend (`tests/contract/toolRegistryParity.test.ts`), que corre en Node.
 * Lo visual vive en `ToolUi` (`tools/<herramienta>/ui.tsx`).
 *
 * Fuera de alcance: la ejecución (`flow-engine/nodes/`) y la validación del
 * grafo (`domains/automations/validation`).
 *
 * Ver docs/architecture/builder-tools.md.
 */

/** Configuración o contenido de un nodo, tal como llega de disco o del editor. */
export type ToolData = Readonly<Record<string, unknown>>;

/** Una salida con nombre de un nodo con varios caminos posibles. */
export interface ToolOutput {
  /** Identidad persistida como `fromOutput` en la arista. Nunca se reutiliza. */
  readonly id: string;
  /** Rótulo visible junto al punto de conexión. */
  readonly label: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  /** Mensaje para el usuario cuando `valid` es `false`. */
  readonly reason: string | null;
}

export const VALID: ValidationResult = { valid: true, reason: null };

export function invalid(reason: string): ValidationResult {
  return { valid: false, reason };
}

export interface ToolDefinition {
  /** Tipo canónico del contrato compartido. Clave del registry. */
  readonly type: NodeType;

  /** Nombre en la paleta y título por defecto de un nodo nuevo. */
  readonly label: string;

  /** Subtítulo de la paleta, en una línea. */
  readonly description: string;

  /** Texto inicial de `content.text` cuando no se declara `defaultContent`. */
  readonly defaultContentText: string;

  /** Contenido con el que nace el nodo. Ausente: `{ text: defaultContentText }`. */
  readonly defaultContent?: ToolData;

  /** Configuración mínima válida con la que nace el nodo. */
  readonly defaultConfig: ToolData;

  /** Título del editor del nodo. */
  readonly editorTitle: string;

  /** `false` para nodos de sistema, que existen en el modelo pero no se ofrecen. */
  readonly availableInPalette: boolean;

  /** Cierra una rama: no exige aristas salientes. */
  readonly terminal: boolean;

  /**
   * `false` si el motor reconoce el tipo pero su handler falla con
   * `*_not_implemented`. Declara la verdad sobre lo que la herramienta hace hoy.
   */
  readonly executable: boolean;

  /**
   * Salidas con nombre que la configuración ofrece.
   *
   * Ausente: el nodo tiene UNA salida implícita y el cascarón pinta su punto.
   * Presente: el nodo tiene exactamente estas salidas (cero incluido); la
   * herramienta las pinta en su `CompactBody` con `OutputHandle`, y el núcleo
   * del builder usa esta lista para descartar aristas que salgan de una salida
   * que ya no existe.
   */
  readonly outputs?: (config: ToolData) => ReadonlyArray<ToolOutput>;

  /** Resumen de una línea para la tarjeta. Ausente: se usa `content.text`. */
  readonly summarize?: (content: ToolData, config: ToolData) => string;

  /** ¿Puede guardarse lo configurado? Ausente: siempre se puede. */
  readonly validate?: (content: ToolData, config: ToolData) => ValidationResult;

  /** Copia de `config` para un duplicado, renovando identidades internas. */
  readonly duplicateConfig?: (config: ToolData) => Record<string, unknown>;

  /** Libera recursos externos a `config` justo antes de borrar el nodo. */
  readonly releaseResources?: (config: ToolData) => void;

  /** Colores de la tarjeta y la paleta. */
  readonly colors: {
    readonly header: string;
    readonly body: string;
    readonly gradient: string;
  };

  /** Glifo compacto de respaldo. */
  readonly glyph: string;
}
