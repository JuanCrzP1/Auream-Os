import { CONTACT_FIELD_LIMITS as LIMITS } from "../../../contracts/ContactFieldContracts";
import type { FieldValueGroup, TidyProposal } from "../../../contracts/ContactFieldToolsContracts";
import { foldAnswer } from "../../../contracts/FieldValues";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { distance } from "./fieldDiscovery";

// ---------------------------------------------------------------------------
// «Ordenar valores»: los valores que los clientes escribieron de varias formas
// («medellin», «Medellín», «MDE») se agrupan y se PROPONE a qué opción pasan.
// Solo propone lo que se puede sostener: la misma palabra sin tildes ni
// signos, una o dos letras de diferencia, o el comienzo de una opción. Lo
// demás queda «como está» y la persona decide. Puro.
// ---------------------------------------------------------------------------

type Counted = { readonly value: string; readonly count: number };

/** La opción a la que se parece un valor, o `null`. */
function nearOption(folded: string, options: ReadonlyArray<string>): string | null {
  for (const option of options) if (foldAnswer(option) === folded) return option;
  if (folded.length < 3) return null;
  let best: { option: string; score: number } | null = null;
  for (const option of options) {
    const target = foldAnswer(option);
    const allowed = Math.min(folded.length, target.length) >= 6 ? 2 : 1;
    const gap = distance(folded, target);
    const prefix = target.startsWith(folded) && folded.length >= 4;
    if (gap <= allowed || prefix) {
      const score = prefix ? 0.5 : gap;
      if (!best || score < best.score) best = { option, score };
    }
  }
  return best?.option ?? null;
}

/**
 * Los grupos y lo que proponemos para cada uno.
 * @param options las opciones de la lista (vacío si el campo aún es texto)
 */
export function proposeTidy(values: ReadonlyArray<Counted>, options: ReadonlyArray<string>, filled: number): FieldValueGroup[] {
  const groups = new Map<string, { values: Counted[]; count: number; option: string | null }>();
  for (const entry of values) {
    const folded = foldAnswer(entry.value);
    const option = nearOption(folded, options);
    const id = option ? `=${foldAnswer(option)}` : folded;
    const group = groups.get(id) ?? { values: [], count: 0, option };
    group.values.push(entry);
    group.count += entry.count;
    groups.set(id, group);
  }
  // Una opción nueva se propone solo si se repite de verdad (no un texto suelto).
  const worthAnOption = Math.max(3, Math.ceil(filled * 0.02));
  let room = LIMITS.maxOptions - options.length;
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map((group): FieldValueGroup => {
      const sorted = [...group.values].sort((a, b) => b.count - a.count);
      let proposal: TidyProposal = { kind: "keep" };
      if (group.option) proposal = { kind: "option", to: group.option };
      else if (group.count >= worthAnOption && room > 0 && sorted[0]!.value.trim().length <= LIMITS.maxOption) {
        proposal = { kind: "new", to: sorted[0]!.value.trim() };
        room -= 1;
      }
      return { values: sorted, count: group.count, proposal };
    });
}

export interface TidyPlan {
  /** Valor escrito → opción a la que pasa (`null`: sin dato). Solo los que cambian. */
  readonly map: Readonly<Record<string, string | null>>;
  /** Las opciones de la lista después de ordenar. */
  readonly options: string[];
}

/** Lo que la persona confirmó, validado: opciones sin repetir, dentro de los límites. */
export function requireTidy(currentOptions: ReadonlyArray<string>, input: unknown): TidyPlan {
  const assignments = Array.isArray((input as { assignments?: unknown } | null)?.assignments) ? ((input as { assignments: unknown[] }).assignments) : [];
  if (assignments.length === 0) throw new ValidationError("Elige al menos un grupo para ordenar.");
  const options = [...currentOptions];
  const canonical = (to: string) => options.find((option) => foldAnswer(option) === foldAnswer(to));
  const map: Record<string, string | null> = {};
  for (const raw of assignments) {
    const item = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const values = (Array.isArray(item["values"]) ? item["values"] : []).filter((value): value is string => typeof value === "string" && value.length > 0);
    if (values.length === 0) continue;
    let to: string | null = null;
    if (item["to"] !== null && item["to"] !== undefined) {
      const wanted = typeof item["to"] === "string" ? item["to"].replace(/\s+/g, " ").trim() : "";
      if (!wanted) throw new ValidationError("Una opción quedó sin nombre.");
      if (wanted.length > LIMITS.maxOption) throw new ValidationError(`Cada opción admite hasta ${LIMITS.maxOption} caracteres.`);
      to = canonical(wanted) ?? wanted;
      if (!canonical(wanted)) options.push(wanted);
    }
    for (const value of values) if (value !== to) map[value] = to;
  }
  if (options.length < LIMITS.minOptions) throw new ValidationError(`Una lista necesita al menos ${LIMITS.minOptions} opciones.`);
  if (options.length > LIMITS.maxOptions) throw new ValidationError(`Una lista admite hasta ${LIMITS.maxOptions} opciones.`);
  if (Object.keys(map).length === 0 && options.length === currentOptions.length) throw new ValidationError("No hay nada que cambiar: todo ya está como lo elegiste.");
  return { map, options };
}
