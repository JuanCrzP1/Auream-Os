import type { NodeType } from "@contracts/FlowSnapshot";
import type { ToolDefinition } from "./ToolDefinition";
import { messageTool } from "./message/definition";
import { waitResponseTool } from "./wait-response/definition";
import { tagsTool } from "./tags/definition";
import { paymentProofTool } from "./payment-proof/definition";
import { conditionalTool } from "./conditional/definition";
import { distributorTool } from "./distributor/definition";
import { pixelTool } from "./pixel/definition";
import { aiExtensionTool } from "./ai-extension/definition";
import { intervalTool } from "./interval/definition";
import { saleApprovedTool } from "./sale-approved/definition";
import { integrationTool } from "./integration/definition";
import { menuTool } from "./menu/definition";
import { notificationTool } from "./notification/definition";
import { endTool } from "./end/definition";

// ---------------------------------------------------------------------------
// Registry de herramientas del builder.
//
// ÚNICA frontera entre el core del builder (paleta, canvas, editor) y las
// herramientas. Ningún componente vuelve a declarar por su cuenta el color, el
// icono, la etiqueta o el título de edición de un tipo de nodo.
//
// CÓMO SE AÑADE UNA HERRAMIENTA NUEVA
//
//   1. `contracts/FlowSnapshot.ts` → añadir el tipo a la unión `NodeType`.
//   2. `flow-engine/nodes/<tipo>/` → handler de ejecución.
//   3. `apps/api/composition/composeNodeRuntime.ts` → registrar el handler.
//   4. `builder/tools/<herramienta>/definition.ts` → su `ToolDefinition`, y
//      `<Herramienta>Icon.tsx` con su SVG.
//   5. Añadir la definición a `TOOLS` aquí abajo, y el icono a `tools/icons.tsx`.
//
// Este módulo es PURO: no importa React. El icono se registra aparte porque
// `validateCanvasGraph` consulta este registry y también lo ejecuta el test de
// paridad del backend, donde no hay runtime de React.
//
// Los pasos 1-3 son inevitables: un nodo es full-stack, y el contrato y el
// motor son compartidos. Lo que esta arquitectura elimina es el paso que antes
// se repetía cinco veces en el frontend y que nadie recordaba entero.
//
// Las 13 herramientas del catálogo oficial están registradas. Siete de ellas
// (`executable: false`) todavía no tienen comportamiento de ejecución: el motor
// reconoce el tipo y su handler falla explícitamente. Esa distinción se declara
// en cada definición, no se esconde.
// ---------------------------------------------------------------------------

/**
 * Catálogo oficial. El orden de declaración ES el orden de la paleta.
 *
 * `end` va al final y queda fuera de la paleta por `availableInPalette: false`.
 */
const TOOLS: ReadonlyArray<ToolDefinition> = [
  messageTool,
  waitResponseTool,
  tagsTool,
  paymentProofTool,
  conditionalTool,
  distributorTool,
  pixelTool,
  aiExtensionTool,
  intervalTool,
  saleApprovedTool,
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
  defaultConfig: {},
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
