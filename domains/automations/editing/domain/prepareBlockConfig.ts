import type { BlockData, BlockRules } from "../../../../contracts/blocks/BlockRules";

// ---------------------------------------------------------------------------
// La configuración que manda un agente, lista para guardar:
//
//   1. se fusiona sobre la actual (solo cambia lo que se manda; las listas se
//      reemplazan enteras),
//   2. cada elemento de una lista sin `id` recibe uno nuevo y único (las
//      salidas de un Menú o una IA, por ejemplo, son esos ids: deben ser
//      estables para que las conexiones no se pierdan),
//   3. se lleva a su forma canónica con el MISMO lector que usan el motor y el
//      editor (valores por defecto, tipos correctos, sin campos desconocidos).
//
// Los campos que el lector descarta se informan, para que el agente corrija.
// ---------------------------------------------------------------------------

export interface PreparedConfig {
  readonly config: BlockData;
  /** Campos enviados que el bloque no tiene (se ignoraron). */
  readonly ignoredFields: ReadonlyArray<string>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Copia profunda de datos JSON (lo que llega de un agente siempre lo es). */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Prefijo de los ids nuevos por lista (los mismos que usa el editor web). */
const ITEM_PREFIX: Readonly<Record<string, string>> = { items: "mi", options: "opt", intents: "intent", outputs: "out", rules: "rule", accounts: "acc", headers: "h", responseMappings: "m" };

function withItemIds(config: Record<string, unknown>, newId: (prefix: string) => string): Record<string, unknown> {
  const result: Record<string, unknown> = { ...config };
  for (const [key, value] of Object.entries(config)) {
    if (!Array.isArray(value)) continue;
    result[key] = value.map((item) => {
      if (!isPlainObject(item)) return item;
      const id = item["id"];
      return typeof id === "string" && id.trim().length > 0 ? item : { ...item, id: newId(ITEM_PREFIX[key] ?? key) };
    });
  }
  return result;
}

export function prepareBlockConfig(rules: BlockRules, current: BlockData, patch: BlockData | undefined, newId: (prefix: string) => string): PreparedConfig {
  const sent = patch ? cloneJson(patch) : {};
  const merged = withItemIds({ ...current, ...sent }, newId);
  const config = rules.normalizeConfig(merged);
  const ignoredFields = Object.keys(sent).filter((key) => !(key in config));
  return { config, ignoredFields };
}
