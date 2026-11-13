import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// «Unir campos»: en los bloques de un flujo, las claves que se unen pasan a la
// que queda — donde el bloque la guarda (Esperar respuesta, Menú, Integración,
// IA), donde la lee un Condicional y dentro de cualquier texto (`{clave}`,
// `{clave|respaldo}`, `{{context.clave}}`). Para deshacer se guarda cómo
// estaba cada bloque, y solo se devuelve si nadie lo cambió después. Puro.
// ---------------------------------------------------------------------------

type Data = Readonly<Record<string, unknown>>;

/** Cómo estaba y cómo quedó un bloque. */
export interface BlockChange {
  readonly flowKey: string;
  readonly flowName: string;
  readonly blockId: string;
  readonly blockName: string;
  readonly before: { readonly content: Data; readonly config: Data };
  readonly after: { readonly content: Data; readonly config: Data };
}

const BRACES = /\{(\s*)([A-Za-z_][A-Za-z0-9_.-]*)(\s*(?:\|[^{}]*)?)\}/g;
const LEGACY = /\{\{(\s*context\.)([A-Za-z0-9_-]+)(\s*)\}\}/g;
const MAX_DEPTH = 8;

/** Comparación estable (la base reordena las claves de un JSON). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Data)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function renameInText(text: string, rename: ReadonlyMap<string, string>): string {
  return text
    .replace(LEGACY, (match, open: string, key: string, close: string) => (rename.has(key) ? `{{${open}${rename.get(key)!}${close}}}` : match))
    .replace(BRACES, (match, open: string, key: string, rest: string) => (rename.has(key) ? `{${open}${rename.get(key)!}${rest}}` : match));
}

function renameDeep(value: unknown, rename: ReadonlyMap<string, string>, depth = 0): unknown {
  if (typeof value === "string") return renameInText(value, rename);
  if (depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => renameDeep(item, rename, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renameDeep(item, rename, depth + 1)]));
  return value;
}

const renamed = (value: unknown, rename: ReadonlyMap<string, string>): unknown => {
  if (typeof value !== "string") return value;
  const key = value.trim().replace(/^context\./, "");
  return rename.has(key) ? rename.get(key)! : value;
};

/** Donde el bloque nombra la clave directamente (lo que guarda y lo que lee un Condicional). */
function renameSlots(type: string, config: Data, rename: ReadonlyMap<string, string>): Data {
  switch (type) {
    case "question":
      return "targetKey" in config ? { ...config, targetKey: renamed(config["targetKey"], rename) } : config;
    case "menu":
      return "saveToField" in config ? { ...config, saveToField: renamed(config["saveToField"], rename) } : config;
    case "ai":
      return "responseVariable" in config ? { ...config, responseVariable: renamed(config["responseVariable"], rename) } : config;
    case "integration":
      return Array.isArray(config["responseMappings"])
        ? { ...config, responseMappings: config["responseMappings"].map((mapping: Data) => (mapping && typeof mapping === "object" ? { ...mapping, field: renamed(mapping["field"], rename) } : mapping)) }
        : config;
    case "condition":
      return Array.isArray(config["rules"])
        ? { ...config, rules: config["rules"].map((rule: Data) => (rule && typeof rule === "object" && rule["category"] === "customField" ? { ...rule, field: renamed(rule["field"], rename) } : rule)) }
        : config;
    default:
      return config;
  }
}

/** El borrador con las claves renombradas y qué bloques cambiaron (ninguno: el mismo borrador). */
export function renameFlowKeys(draft: BuilderFlowSnapshot, rename: ReadonlyMap<string, string>): { readonly draft: BuilderFlowSnapshot; readonly changes: BlockChange[] } {
  const changes: BlockChange[] = [];
  const nodes = Object.fromEntries(
    Object.entries(draft.nodes).map(([id, node]) => {
      const content = renameDeep(node.content, rename) as Data;
      const config = renameSlots(node.type, renameDeep(node.config, rename) as Data, rename);
      if (canonical([content, config]) === canonical([node.content, node.config])) return [id, node];
      changes.push({ flowKey: draft.flow.key, flowName: draft.flow.name, blockId: node.id, blockName: node.name, before: { content: node.content, config: node.config }, after: { content, config } });
      return [id, { ...node, content, config }];
    })
  );
  return changes.length === 0 ? { draft, changes } : { draft: { ...draft, nodes } as BuilderFlowSnapshot, changes };
}

/** Devuelve cada bloque a como estaba, solo si sigue como lo dejó la unión (si alguien lo editó después, no se toca). */
export function restoreFlowBlocks(draft: BuilderFlowSnapshot, changes: ReadonlyArray<BlockChange>): { readonly draft: BuilderFlowSnapshot; readonly restored: number; readonly skipped: number } {
  let restored = 0;
  let skipped = 0;
  const nodes = { ...draft.nodes } as Record<string, BuilderFlowSnapshot["nodes"][string]>;
  for (const change of changes) {
    const node = nodes[change.blockId];
    if (!node || canonical([node.content, node.config]) !== canonical([change.after.content, change.after.config])) {
      skipped += 1;
      continue;
    }
    nodes[change.blockId] = { ...node, content: change.before.content, config: change.before.config } as typeof node;
    restored += 1;
  }
  return { draft: restored === 0 ? draft : ({ ...draft, nodes } as BuilderFlowSnapshot), restored, skipped };
}
