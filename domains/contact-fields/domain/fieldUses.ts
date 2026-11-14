import type { FieldUse } from "../../../contracts/ContactFieldContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Quién llena y quién lee cada dato en un flujo, leyendo la configuración de
// sus bloques (la misma que guarda el editor):
//
//   llena   Esperar respuesta (`targetKey`), Menú (`saveToField`),
//           Integración (`responseMappings[].field`), Extensión IA (`responseVariable`),
//           Guardar dato (`field`)
//   lee     cualquier texto con `{clave}` o `{clave|…}`, y las reglas del
//           Condicional sobre un campo del cliente (`customField`)
//
// Lo que guardan el Comprobante, Registrar venta y los errores es técnico:
// se marca aparte para no ofrecerlo como dato del cliente.
// ---------------------------------------------------------------------------

export interface KeyUse {
  readonly key: string;
  readonly use: FieldUse;
}

export interface FlowKeys {
  readonly uses: ReadonlyArray<KeyUse>;
  /** Claves que guardan bloques técnicos (resultados de comprobante, venta, errores). */
  readonly technical: ReadonlySet<string>;
}

const VARIABLE = /\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*(?:\|[^}]*)?\}/g;
const MAX_DEPTH = 6;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Las claves que se leen dentro de cualquier texto del bloque. */
function readKeys(value: unknown, depth = 0, found = new Set<string>()): Set<string> {
  if (depth > MAX_DEPTH) return found;
  if (typeof value === "string") {
    for (const match of value.matchAll(VARIABLE)) found.add(match[1]!);
  } else if (Array.isArray(value)) {
    for (const item of value) readKeys(item, depth + 1, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) readKeys(item, depth + 1, found);
  }
  return found;
}

/** Las claves que el bloque guarda (y si son técnicas). */
function filledKeys(type: string, config: Readonly<Record<string, unknown>>): { readonly keys: string[]; readonly technical: string[] } {
  switch (type) {
    case "question":
      return { keys: [text(config["targetKey"])].filter(Boolean), technical: [] };
    case "menu":
      return { keys: [text(config["saveToField"])].filter(Boolean), technical: [] };
    case "integration": {
      const mappings = Array.isArray(config["responseMappings"]) ? config["responseMappings"] : [];
      return { keys: mappings.map((mapping) => text((mapping as Record<string, unknown>)["field"])).filter(Boolean), technical: [] };
    }
    case "ai":
      return { keys: [text(config["responseVariable"])].filter(Boolean), technical: [text(config["errorVariable"])].filter(Boolean) };
    case "set-field":
      return { keys: [text(config["field"])].filter(Boolean), technical: [] };
    case "payment-proof":
      return { keys: [], technical: [text(config["resultVariable"]), text(config["errorVariable"])].filter(Boolean) };
    case "record-sale":
      return { keys: [], technical: [text(config["resultVariable"])].filter(Boolean) };
    default:
      return { keys: [], technical: [] };
  }
}

/** Las reglas del Condicional que leen un campo del cliente. */
function conditionKeys(config: Readonly<Record<string, unknown>>): string[] {
  const rules = Array.isArray(config["rules"]) ? config["rules"] : [];
  return rules
    .map((rule) => rule as Record<string, unknown>)
    .filter((rule) => rule["category"] === "customField")
    .map((rule) => text(rule["field"]))
    .filter(Boolean);
}

/** Todo lo que un flujo llena y lee. Un bloque que llena y lee la misma clave cuenta como «llena». */
export function flowKeys(draft: BuilderFlowSnapshot): FlowKeys {
  const uses: KeyUse[] = [];
  const technical = new Set<string>();
  for (const node of Object.values(draft.nodes)) {
    const base = { flowKey: draft.flow.key, flowName: draft.flow.name, blockId: node.id, blockName: node.name, blockType: node.type };
    const filled = filledKeys(node.type, node.config);
    for (const key of filled.technical) technical.add(key);
    for (const key of new Set(filled.keys)) uses.push({ key, use: { ...base, role: "fills" } });
    const read = readKeys([node.content, node.config]);
    for (const key of conditionKeys(node.config)) read.add(key);
    for (const key of read) if (!filled.keys.includes(key)) uses.push({ key, use: { ...base, role: "reads" } });
  }
  return { uses, technical };
}

/** Los usos de una clave en varios flujos (una clave con punto cuenta también por su raíz: `comprobante.valor` → `comprobante`). */
export function usesOf(all: ReadonlyArray<KeyUse>, key: string): FieldUse[] {
  return all.filter((entry) => entry.key === key).map((entry) => entry.use);
}

/** ¿La clave es técnica? Por su bloque o por su forma (`kie.ai.status`, `shotstack_id`, `x.error`). */
export function isTechnicalKey(key: string, technical: ReadonlySet<string>): boolean {
  const root = key.split(".")[0]!;
  if (technical.has(key) || technical.has(root)) return true;
  return /(^|[._-])(id|url|status|error|erro|token|raw|json)$/i.test(key) || /^(ai|kie|shotstack|http|response|webhook)([._-]|$)/i.test(key);
}
