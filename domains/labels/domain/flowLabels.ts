import type { LabelUse } from "../../../contracts/LabelManagementContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import { labelKey } from "../../contacts/domain/Label";

// ---------------------------------------------------------------------------
// Las etiquetas dentro de los flujos, que las nombran (no las guardan por id):
//
//   Etiquetas    `config.tags`: las pone o las quita (`config.action`)
//   Condicional  reglas `category: "tag"`: pregunta si la tiene (`value`)
//
// Dónde se usa cada una y cambiarle el nombre en un flujo (renombrar o unir
// una en otra). Se comparan como las lee una persona (`labelKey`). Puro.
// ---------------------------------------------------------------------------

type FlowUse = Extract<LabelUse, { kind: "flow" }>;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const rulesOf = (config: Readonly<Record<string, unknown>>) => (Array.isArray(config["rules"]) ? (config["rules"] as Array<Record<string, unknown>>) : []);
const tagsOf = (config: Readonly<Record<string, unknown>>) => (Array.isArray(config["tags"]) ? (config["tags"] as unknown[]).map(text) : []);

/** Por cada nombre (`labelKey`), los bloques que lo usan. */
export function flowLabelUses(drafts: ReadonlyArray<BuilderFlowSnapshot>): ReadonlyMap<string, FlowUse[]> {
  const uses = new Map<string, FlowUse[]>();
  const add = (name: string, use: FlowUse) => {
    const key = labelKey(name);
    if (!key) return;
    const list = uses.get(key) ?? [];
    if (!list.some((item) => item.flowKey === use.flowKey && item.blockId === use.blockId)) uses.set(key, [...list, use]);
  };
  for (const draft of drafts) {
    for (const node of Object.values(draft.nodes)) {
      const base = { kind: "flow" as const, flowKey: draft.flow.key, flowName: draft.flow.name, blockId: node.id, blockName: node.name };
      if (node.type === "tags") {
        const how = node.config["action"] === "remove" ? "removes" : "adds";
        for (const name of tagsOf(node.config)) add(name, { ...base, how });
      }
      if (node.type === "condition") {
        for (const rule of rulesOf(node.config)) if (rule["category"] === "tag") add(text(rule["value"]), { ...base, how: "checks" });
      }
    }
  }
  return uses;
}

export interface LabelRename {
  /** Los nombres que se reemplazan (la de origen y, al unir, cualquiera que se lea igual). */
  readonly from: ReadonlyArray<string>;
  readonly to: string;
}

/** El flujo con el nombre cambiado en sus bloques, y cuántos bloques cambiaron. Una lista que ya tiene el nuevo no lo repite. */
export function renameLabelInFlow(draft: BuilderFlowSnapshot, rename: LabelRename): { readonly draft: BuilderFlowSnapshot; readonly changed: number } {
  const keys = new Set(rename.from.map(labelKey));
  const matches = (name: string) => keys.has(labelKey(name));
  let changed = 0;
  const nodes = Object.fromEntries(
    Object.entries(draft.nodes).map(([id, node]) => {
      if (node.type === "tags" && tagsOf(node.config).some(matches)) {
        changed += 1;
        const tags: string[] = [];
        for (const name of tagsOf(node.config).map((name) => (matches(name) ? rename.to : name))) if (!tags.some((other) => labelKey(other) === labelKey(name))) tags.push(name);
        return [id, { ...node, config: { ...node.config, tags } }];
      }
      if (node.type === "condition" && rulesOf(node.config).some((rule) => rule["category"] === "tag" && matches(text(rule["value"])))) {
        changed += 1;
        const rules = rulesOf(node.config).map((rule) => (rule["category"] === "tag" && matches(text(rule["value"])) ? { ...rule, value: rename.to } : rule));
        return [id, { ...node, config: { ...node.config, rules } }];
      }
      return [id, node];
    })
  );
  return { draft: changed > 0 ? { ...draft, nodes } : draft, changed };
}
