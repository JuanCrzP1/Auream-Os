import type { NodeType } from "@contracts/FlowSnapshot";
import type { ToolUi } from "./ToolUi";
import { messageUi } from "./message/ui";
import { waitResponseUi } from "./wait-response/ui";
import { tagsUi } from "./tags/ui";
import { paymentProofUi } from "./payment-proof/ui";
import { conditionalUi } from "./conditional/ui";
import { distributorUi } from "./distributor/ui";
import { pixelUi } from "./pixel/ui";
import { aiExtensionUi } from "./ai-extension/ui";
import { intervalUi } from "./interval/ui";
import { saleApprovedUi } from "./sale-approved/ui";
import { integrationUi } from "./integration/ui";
import { menuUi } from "./menu/ui";
import { notificationUi } from "./notification/ui";
import { endUi } from "./end/ui";

// ---------------------------------------------------------------------------
// Barril de UI de las herramientas.
//
// Mitad React del catálogo. La otra mitad es `registry.ts`, que es PURO y no
// puede importar nada de aquí: lo ejecuta el test de paridad del backend en un
// entorno Node donde un `.tsx` ni se resuelve.
//
// Sustituye a `tools/icons.tsx`, que era un `Record<NodeType, Icon>`: un mapa
// POR ASPECTO. Con ese patrón, cada aspecto visual nuevo —forma, cuerpo
// compacto, editor— habría añadido otro mapa que recordar actualizar, que es
// exactamente la dispersión que la regla A4 prohíbe.
//
// Aquí hay UN registro POR HERRAMIENTA. Añadir un aspecto visual es añadir un
// campo a `ToolUi`, no un mapa nuevo. Y el tipo viaja dentro del objeto, igual
// que en `registry.ts`, así que una clave no puede desincronizarse de lo que
// describe.
//
// CÓMO SE AÑADE UNA HERRAMIENTA
//
//   1. `tools/<herramienta>/ui.tsx` → su `ToolUi`.
//   2. Añadirlo a `TOOL_UIS` aquí abajo.
//
// Olvidar el paso 2 no pasa desapercibido: `toolRegistry.test.ts` compara este
// catálogo con el de `registry.ts` en ambos sentidos y falla si difieren.
// ---------------------------------------------------------------------------

/** Catálogo visual. El orden no importa: quien ordena la paleta es el registry. */
const TOOL_UIS: ReadonlyArray<ToolUi> = [
  messageUi,
  waitResponseUi,
  tagsUi,
  paymentProofUi,
  conditionalUi,
  distributorUi,
  pixelUi,
  aiExtensionUi,
  intervalUi,
  saleApprovedUi,
  integrationUi,
  menuUi,
  notificationUi,
  endUi
];

const UI_BY_TYPE = new Map<string, ToolUi>(TOOL_UIS.map((ui) => [ui.type, ui]));

/**
 * Icono de un tipo que este catálogo no conoce.
 *
 * Un flujo guardado puede traer un tipo retirado en una versión anterior. El
 * lienzo tiene que poder pintarlo —degradado, pero visible y borrable— en lugar
 * de caerse o de dejar un hueco mudo que el usuario no sabe interpretar.
 */
function UnknownToolIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" strokeDasharray="3 2.5" />
      <line x1="10" y1="6.5" x2="10" y2="10.5" />
      <circle cx="10" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Presentación de un tipo desconocido. Sin cuerpo propio ni editor: no se
 * inventa una configuración para algo que esta versión ya no sabe interpretar.
 */
const UNKNOWN_UI_FALLBACK: Omit<ToolUi, "type"> = {
  Icon: UnknownToolIcon,
  frame: "card"
};

/** UI de un tipo conocido, o `null` si este catálogo no lo reconoce. */
export function findToolUi(type: string): ToolUi | null {
  return UI_BY_TYPE.get(type) ?? null;
}

/**
 * UI para pintar, siempre renderizable.
 *
 * Simétrico a `resolveTool` del registry puro: un tipo desconocido cae en la
 * presentación neutra en lugar de romper el lienzo.
 */
export function resolveToolUi(type: string): ToolUi {
  return UI_BY_TYPE.get(type) ?? { ...UNKNOWN_UI_FALLBACK, type: type as NodeType };
}

/**
 * Tipos con UI declarada.
 *
 * Simétrico a `listAllTools()` del registry: permite comprobar en AMBOS
 * sentidos que las dos mitades del catálogo hablan del mismo conjunto. Sin
 * esto, una herramienta sin icono se pintaba sin él, en silencio y sin que
 * ningún test lo notara.
 */
export function listUiTypes(): ReadonlyArray<NodeType> {
  return TOOL_UIS.map((ui) => ui.type);
}
