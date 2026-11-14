import { businessKeysIn, type BusinessDataExample, type BusinessDataUse } from "../../../contracts/BusinessDataContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Dónde se usa cada dato del negocio y un mensaje real que lo usa («Así lo ve
// tu cliente»). Se lee lo que cada lugar tiene escrito:
//
//   flujos         cualquier texto de un bloque con `{g_clave}`, y las reglas
//                  del Condicional sobre una «Variable global»
//   difusiones     el texto de las que aún se van a enviar (programadas, en
//                  envío, en prueba o pausadas)
//   respuestas     el texto y los pies de foto de cada respuesta rápida
//
// Puro: recibe lo leído y devuelve los usos por clave.
// ---------------------------------------------------------------------------

export interface BroadcastText {
  readonly id: string;
  readonly name: string;
  /** Cuándo sale, si está programada (ISO). */
  readonly sendAt?: string | null;
  readonly texts: ReadonlyArray<string>;
}

export interface QuickReplyText {
  readonly id: string;
  readonly shortcut: string;
  readonly texts: ReadonlyArray<string>;
}

export interface BusinessDataUsage {
  readonly uses: ReadonlyMap<string, BusinessDataUse[]>;
  readonly examples: ReadonlyMap<string, BusinessDataExample>;
}

const MAX_DEPTH = 6;

/** Los textos de un bloque, en orden (primero lo que ve el cliente). */
function textsOf(value: unknown, depth = 0, found: string[] = []): string[] {
  if (depth > MAX_DEPTH) return found;
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) for (const item of value) textsOf(item, depth + 1, found);
  else if (value && typeof value === "object") for (const item of Object.values(value)) textsOf(item, depth + 1, found);
  return found;
}

/** Las reglas del Condicional sobre una variable global. */
function conditionKeys(config: Readonly<Record<string, unknown>>): string[] {
  const rules = Array.isArray(config["rules"]) ? config["rules"] : [];
  return rules
    .map((rule) => rule as Record<string, unknown>)
    .filter((rule) => rule["category"] === "globalVariable" && typeof rule["field"] === "string")
    .map((rule) => String(rule["field"]).trim());
}

export function businessDataUsage(flows: ReadonlyArray<BuilderFlowSnapshot>, broadcasts: ReadonlyArray<BroadcastText>, quickReplies: ReadonlyArray<QuickReplyText>): BusinessDataUsage {
  const uses = new Map<string, BusinessDataUse[]>();
  const examples = new Map<string, BusinessDataExample>();
  const add = (key: string, use: BusinessDataUse) => uses.set(key, [...(uses.get(key) ?? []), use]);
  // El primer texto donde aparece: el de un flujo antes que el de una difusión o una respuesta.
  const sample = (texts: ReadonlyArray<string>, source: string) => {
    for (const text of texts) for (const key of businessKeysIn(text)) if (!examples.has(key)) examples.set(key, { template: text, source });
  };

  for (const flow of flows) {
    for (const node of Object.values(flow.nodes)) {
      const texts = textsOf([node.content, node.config]);
      const keys = new Set([...texts.flatMap(businessKeysIn), ...conditionKeys(node.config)]);
      for (const key of keys) add(key, { kind: "flow", flowKey: flow.flow.key, flowName: flow.flow.name, blockId: node.id, blockName: node.name, blockType: node.type });
      sample(texts, `Flujo «${flow.flow.name}» · ${node.name}`);
    }
  }
  for (const broadcast of broadcasts) {
    for (const key of new Set(broadcast.texts.flatMap(businessKeysIn))) add(key, { kind: "broadcast", id: broadcast.id, name: broadcast.name, sendAt: broadcast.sendAt ?? null });
    sample(broadcast.texts, `Difusión «${broadcast.name}»`);
  }
  for (const reply of quickReplies) {
    for (const key of new Set(reply.texts.flatMap(businessKeysIn))) add(key, { kind: "quickReply", id: reply.id, shortcut: reply.shortcut });
    sample(reply.texts, `Respuesta rápida /${reply.shortcut}`);
  }
  return { uses, examples };
}
