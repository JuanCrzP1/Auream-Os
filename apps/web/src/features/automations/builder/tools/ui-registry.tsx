import type { NodeType } from "@contracts/FlowSnapshot";
import type { ToolUi } from "./ToolUi";
import { startUi } from "./start/ui";
import { messageUi } from "./message/ui";
import { waitResponseUi } from "./wait-response/ui";
import { tagsUi } from "./tags/ui";
import { paymentProofUi } from "./payment-proof/ui";
import { recordSaleUi } from "./record-sale/ui";
import { conditionalUi } from "./conditional/ui";
import { distributorUi } from "./distributor/ui";
import { pixelUi } from "./pixel/ui";
import { aiExtensionUi } from "./ai-extension/ui";
import { intervalUi } from "./interval/ui";
import { integrationUi } from "./integration/ui";
import { menuUi } from "./menu/ui";
import { notificationUi } from "./notification/ui";
import { endUi } from "./end/ui";

// ---------------------------------------------------------------------------
// Mitad React del catálogo: un `ToolUi` por herramienta. `toolUiRegistry.test`
// comprueba que coincide con `registry.ts` en ambos sentidos.
// ---------------------------------------------------------------------------

/** Catálogo visual. El orden no importa: quien ordena la paleta es el registry. */
const TOOL_UIS: ReadonlyArray<ToolUi> = [
  startUi,
  messageUi,
  waitResponseUi,
  tagsUi,
  paymentProofUi,
  recordSaleUi,
  conditionalUi,
  distributorUi,
  pixelUi,
  aiExtensionUi,
  intervalUi,
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
