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

import type { BlockData, BlockOutput, BlockCheck, BlockRules } from "@contracts/blocks/BlockRules";

export { VALID, invalid } from "@contracts/blocks/BlockRules";

/** Configuración o contenido de un nodo, tal como llega de disco o del editor. */
export type ToolData = BlockData;

/** Una salida con nombre de un nodo con varios caminos posibles. */
export type ToolOutput = BlockOutput;

export type ValidationResult = BlockCheck;

/**
 * Una herramienta del builder = las REGLAS del bloque (compartidas con el
 * servidor: `contracts/blocks/blockCatalog.ts`) + lo que solo necesita el
 * editor: textos de la paleta y del editor, resumen, copia, recursos y colores.
 */
export interface ToolDefinition extends BlockRules {
  /** Subtítulo de la paleta, en una línea. */
  readonly description: string;

  /** Texto de respaldo del preview cuando el nodo no tiene contenido propio. */
  readonly defaultContentText: string;

  /** Título del editor del nodo. */
  readonly editorTitle: string;

  /**
   * `false` si el motor reconoce el tipo pero su handler falla con
   * `*_not_implemented`. Declara la verdad sobre lo que la herramienta hace hoy.
   */
  readonly executable: boolean;

  /** Resumen de una línea para la tarjeta. Ausente: se usa `content.text`. */
  readonly summarize?: (content: ToolData, config: ToolData) => string;

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
