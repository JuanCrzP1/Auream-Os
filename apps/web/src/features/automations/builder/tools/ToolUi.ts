import type { ComponentType } from "react";
import type { NodeType } from "@contracts/FlowSnapshot";
import type { NodePatch } from "../services/applyNodePatch";
import type { ToolOutput } from "./ToolDefinition";
import type { ToolResources } from "./ToolResources";

/**
 * Mitad REACT del contrato de una herramienta: cómo se ve y cómo se configura.
 *
 * Separada de `ToolDefinition` porque el registry puro se ejecuta en Node sin
 * React. La extensión `.tsx` de `ui.tsx` es la barrera: importarlo desde la
 * cadena pura rompe el test de paridad del backend en lugar de fallar tarde.
 *
 * Nada de negocio aquí: ni ejecución, ni acceso al lienzo, al grafo o al motor.
 */

/**
 * Silueta del nodo en reposo. Comunica la CLASE de nodo, no la herramienta:
 *   card     envía o pide algo y continúa
 *   diamond  decide por dónde sigue el flujo
 *   circle   actúa sobre algo externo y continúa
 *   pill     nodo de sistema
 */
export type ToolFrame = "card" | "diamond" | "circle" | "pill";

export type ToolSize = "sm" | "md" | "lg";

/** Lo configurado en un nodo. Derivado de `NodePatch` para que lectura y escritura no diverjan. */
export type ToolDraft = Required<NodePatch>;

export interface ToolCompactProps {
  readonly draft: ToolDraft;
  /**
   * Salidas con nombre calculadas por el núcleo a partir de `outputs()`.
   * Presente solo si la herramienta las declara: entonces el cuerpo pinta un
   * `OutputHandle` por cada una y el cascarón no pone su salida única.
   */
  readonly outputs?: ReadonlyArray<ToolOutput>;
}

/**
 * Editor de la herramienta. Recibe datos y un callback, nunca el nodo, el
 * lienzo ni el motor: un editor no puede convertirse en un mini-builder.
 */
export interface ToolEditorProps {
  readonly draft: ToolDraft;
  readonly onChange: (patch: NodePatch) => void;
  /**
   * Recursos de la cuenta para ofrecer al configurar (p. ej. el catálogo de
   * etiquetas). Opcional: el editor funciona igual sin ellos.
   */
  readonly resources?: ToolResources;
}

export interface ToolUi {
  readonly type: NodeType;
  readonly Icon: ComponentType;
  readonly frame: ToolFrame;
  readonly size?: ToolSize;
  /** Cuerpo propio en reposo. Ausente: resumen genérico de una línea. */
  readonly CompactBody?: ComponentType<ToolCompactProps>;
  /** Editor propio. Ausente: aviso de «sin configuración». */
  readonly Editor?: ComponentType<ToolEditorProps>;
}
