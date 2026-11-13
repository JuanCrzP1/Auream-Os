import { CONTACT_FIELD_LIMITS, type ContactFieldType } from "../../../contracts/ContactFieldContracts";
import { coerceFieldValue, fold } from "./ContactField";

// ---------------------------------------------------------------------------
// «El primer día»: para cada dato que ya guardan tus flujos o integraciones,
// qué tipo PROPONEMOS según sus valores reales, y qué otros datos parecen el
// mismo con otro nombre. Solo propone: la persona confirma.
// ---------------------------------------------------------------------------

/** Lo que se sabe de los valores guardados de una clave (los más frecuentes primero). */
export interface ObservedValues {
  readonly filled: number;
  readonly distinct: number;
  readonly top: ReadonlyArray<{ readonly value: string; readonly count: number }>;
}

/** Hasta cuántas opciones distintas un dato se propone como lista. */
const LIST_MAX_OPTIONS = 12;

const every = (values: ReadonlyArray<string>, type: ContactFieldType) =>
  values.length > 0 && values.every((value) => coerceFieldValue({ type, options: [] }, value) !== undefined);

/** Las opciones de una lista: los valores escritos parecido se agrupan (gana la forma más usada). */
export function groupedOptions(top: ObservedValues["top"]): string[] {
  const groups = new Map<string, { readonly value: string; count: number }>();
  for (const entry of top) {
    const folded = fold(entry.value);
    const current = groups.get(folded);
    if (current) current.count += entry.count;
    else groups.set(folded, { value: entry.value.trim(), count: entry.count });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).map((group) => group.value.slice(0, CONTACT_FIELD_LIMITS.maxOption));
}

/** El tipo que proponemos para un dato, por sus valores. Sin valores: texto. */
export function suggestType(observed: ObservedValues): { readonly type: ContactFieldType; readonly options: string[] } {
  const values = observed.top.map((entry) => entry.value);
  if (values.length === 0) return { type: "text", options: [] };
  if (every(values, "boolean")) return { type: "boolean", options: [] };
  if (every(values, "date")) return { type: "date", options: [] };
  if (every(values, "number")) return { type: "number", options: [] };
  const options = groupedOptions(observed.top);
  // Una lista: pocas opciones que se repiten mucho (no un texto libre que nadie repite).
  if (options.length >= CONTACT_FIELD_LIMITS.minOptions && options.length <= LIST_MAX_OPTIONS && observed.filled >= options.length * 3) {
    return { type: "list", options };
  }
  return { type: "text", options: [] };
}

/** Distancia de edición (pocas letras de diferencia = probablemente el mismo dato). */
function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]!;
      previous[j] = Math.min(previous[j]! + 1, previous[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length]!;
}

/** La forma de comparar dos claves: sin separadores ni prefijos de bloque (`respuesta_menu` ~ `respuesta`). */
const stem = (key: string) => fold(key).replace(/[._-]+/g, "").replace(/(menu|lead|bot|ia|ai)$/u, "");

/** ¿Dos claves parecen el mismo dato? `resposta` ~ `respuesta`, `respuesta_menu` ~ `respuesta`. */
export function looksAlike(a: string, b: string): boolean {
  if (a === b) return false;
  const [x, y] = [stem(a), stem(b)];
  if (x.length < 4 || y.length < 4) return false;
  return x === y || distance(x, y) <= (Math.min(x.length, y.length) >= 7 ? 2 : 1);
}
