import type { NodeType } from "@contracts/FlowSnapshot";
import type { ToolDefinition } from "./ToolDefinition";
import { startTool } from "./start/definition";
import { messageTool } from "./message/definition";
import { waitResponseTool } from "./wait-response/definition";
import { tagsTool } from "./tags/definition";
import { paymentProofTool } from "./payment-proof/definition";
import { conditionalTool } from "./conditional/definition";
import { distributorTool } from "./distributor/definition";
import { pixelTool } from "./pixel/definition";
import { aiExtensionTool } from "./ai-extension/definition";
import { intervalTool } from "./interval/definition";
import { integrationTool } from "./integration/definition";
import { menuTool } from "./menu/definition";
import { notificationTool } from "./notification/definition";
import { endTool } from "./end/definition";

// ---------------------------------------------------------------------------
// Registry de herramientas: ÚNICA frontera entre el núcleo del builder y las
// herramientas. Puro (sin React): también lo carga el test de paridad del
// backend. La mitad visual está en `ui-registry.tsx`.
//
// Añadir una herramienta: ver docs/architecture/builder-tools.md.
//
// Qué herramientas ejecuta hoy el motor lo dice `executable` en cada
// definición; este archivo no lo repite para no desactualizarse.
// ---------------------------------------------------------------------------

/**
 * Catálogo oficial. El orden de declaración ES el orden de la paleta.
 *
 * `start` y `end` son nodos de sistema: quedan fuera de la paleta por
 * `availableInPalette: false`.
 */
const TOOLS: ReadonlyArray<ToolDefinition> = [
  startTool,
  messageTool,
  waitResponseTool,
  tagsTool,
  paymentProofTool,
  conditionalTool,
  distributorTool,
  pixelTool,
  aiExtensionTool,
  intervalTool,
  integrationTool,
  menuTool,
  notificationTool,
  endTool
];

const TOOLS_BY_TYPE = new Map<string, ToolDefinition>(TOOLS.map((tool) => [tool.type, tool]));

/**
 * Presentación de un tipo de nodo que el registry no conoce.
 *
 * Un flow guardado puede contener un tipo retirado en una versión anterior de
 * la plataforma. Sin este fallback, el canvas leería `undefined.header` y la
 * pantalla se caería entera en lugar de mostrar el problema.
 */
const UNKNOWN_TOOL_FALLBACK: Omit<ToolDefinition, "type"> = {
  label: "Herramienta no disponible",
  description: "Tipo de bloque no soportado en esta versión",
  defaultContentText: "",
  editorTitle: "Bloque no soportado",
  availableInPalette: false,
  terminal: false,
  executable: false,
  defaultContent: {},
  defaultConfig: {},
  // Un tipo desconocido se conserva tal cual: no se sabe leerlo.
  normalizeConfig: (config) => config,
  colors: {
    header: "#64748b",
    body: "#475569",
    gradient: "linear-gradient(135deg,#94a3b8,#475569)"
  },
  glyph: "?"
};

/** Herramientas ofrecidas al usuario. Excluye los nodos de sistema. */
export function listPaletteTools(): ReadonlyArray<ToolDefinition> {
  return TOOLS.filter((tool) => tool.availableInPalette);
}

/** Definición de un tipo conocido, o `null` si el registry no lo reconoce. */
export function findTool(type: string): ToolDefinition | null {
  return TOOLS_BY_TYPE.get(type) ?? null;
}

/** Alias de lectura de `findTool`: `getTool("tags")`. */
export const getTool = findTool;

/** Catálogo completo, incluidos los nodos de sistema. */
export function listAllTools(): ReadonlyArray<ToolDefinition> {
  return TOOLS;
}

/**
 * Definición para pintar y editar, con degradado seguro.
 *
 * Devuelve siempre algo renderizable: un tipo desconocido cae en la
 * presentación neutra en lugar de romper el canvas.
 */
export function resolveTool(type: string): ToolDefinition {
  return TOOLS_BY_TYPE.get(type) ?? { ...UNKNOWN_TOOL_FALLBACK, type: type as NodeType };
}

/** `true` si el tipo cierra una rama del flujo. */
export function isTerminalType(type: string): boolean {
  return findTool(type)?.terminal ?? false;
}

/** `true` si el motor sabe ejecutar hoy este tipo de nodo. */
export function isExecutableType(type: string): boolean {
  return findTool(type)?.executable ?? false;
}
