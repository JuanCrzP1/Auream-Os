import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { FieldOperationSummary, FieldSuggestions } from "../../../contracts/ContactFieldToolsContracts";
import { FIELD_OPERATION_UNDO_DAYS } from "../../../contracts/ContactFieldToolsContracts";
import type { StoredOperation } from "../application/ContactFieldToolPorts";
import { looksAlike, suggestType, type ObservedValues } from "./fieldDiscovery";

// ---------------------------------------------------------------------------
// Lo que conviene ordenar en el catálogo, visto en los datos reales: campos
// de lista con valores fuera de sus opciones, campos de texto que en realidad
// son una lista, y claves que parecen el mismo dato. Solo sugiere. Puro.
// ---------------------------------------------------------------------------

const MAX_SUGGESTIONS = 5;
const DAY_MS = 86_400_000;

export function operationSummary(operation: StoredOperation): FieldOperationSummary {
  return {
    id: operation.id,
    kind: operation.kind,
    title: operation.title,
    contacts: operation.contacts,
    at: operation.createdAt,
    undoUntil: new Date(Date.parse(operation.createdAt) + FIELD_OPERATION_UNDO_DAYS * DAY_MS).toISOString()
  };
}

function toTidy(definitions: ReadonlyArray<ContactFieldDefinition>, observed: ReadonlyMap<string, ObservedValues>): FieldSuggestions["toTidy"] {
  const found: Array<FieldSuggestions["toTidy"][number]> = [];
  for (const field of definitions) {
    const seen = observed.get(field.key);
    if (!seen || seen.top.length === 0) continue;
    if (field.type === "list") {
      // Fuera de la lista, o la misma opción escrita distinto («medellin» por «Medellín»).
      const stray = seen.top.filter((entry) => !field.options.includes(entry.value));
      if (stray.length > 0) found.push({ fieldId: field.id, label: field.label, kind: "stray", count: stray.length, examples: stray.slice(0, 3).map((entry) => entry.value) });
    } else if (field.type === "text" && suggestType(seen).type === "list") {
      found.push({ fieldId: field.id, label: field.label, kind: "asList", count: seen.distinct, examples: seen.top.slice(0, 3).map((entry) => entry.value) });
    }
  }
  return found.slice(0, MAX_SUGGESTIONS);
}

/** Grupos de claves parecidas (si a~b y b~c, las tres van juntas). */
function toMerge(keys: ReadonlyArray<string>): FieldSuggestions["toMerge"] {
  const group = new Map<string, string>(keys.map((key) => [key, key]));
  const root = (key: string): string => (group.get(key) === key ? key : root(group.get(key)!));
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      if (looksAlike(keys[i]!, keys[j]!)) group.set(root(keys[j]!), root(keys[i]!));
    }
  }
  const groups = new Map<string, string[]>();
  for (const key of keys) groups.set(root(key), [...(groups.get(root(key)) ?? []), key]);
  return [...groups.values()].filter((members) => members.length > 1).slice(0, MAX_SUGGESTIONS).map((members) => ({ keys: members }));
}

/**
 * @param looseKeys datos que guardan los flujos y aún no son campos (sin los técnicos)
 */
export function fieldSuggestions(
  definitions: ReadonlyArray<ContactFieldDefinition>,
  observed: ReadonlyMap<string, ObservedValues>,
  looseKeys: ReadonlyArray<string>,
  operations: ReadonlyArray<StoredOperation>
): FieldSuggestions {
  return {
    toTidy: toTidy(definitions, observed),
    toMerge: toMerge([...definitions.map((field) => field.key), ...looseKeys]),
    operations: operations.map(operationSummary)
  };
}
