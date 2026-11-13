import { CONTACT_FIELD_KEY_PATTERN, type ContactFieldValue } from "./ContactContracts";
import { parseFieldDate, parseFieldNumber } from "./FieldValues";

// ---------------------------------------------------------------------------
// Filtrar clientes por sus Campos del cliente — UNA forma para Difusiones (a
// quién le llega) y el CRM (la lista de contactos). Todos los filtros se
// cumplen a la vez. Puro: lo leen el servidor (SQL y memoria) y la web.
//
//   in       es una de estas (texto o lista; sin mayúsculas)
//   yes/no   sí o no
//   between  entre dos números o dos fechas (cualquiera de los dos bordes puede faltar)
//   filled   tiene el dato · empty  no lo tiene
// ---------------------------------------------------------------------------

export const FIELD_FILTER_OPS = ["in", "yes", "no", "between", "filled", "empty"] as const;
export type FieldFilterOp = (typeof FIELD_FILTER_OPS)[number];

export interface FieldFilter {
  readonly key: string;
  readonly op: FieldFilterOp;
  /** `in`: los valores aceptados. */
  readonly values?: ReadonlyArray<string>;
  /** `between`: número («500.000») o fecha (AAAA-MM-DD). */
  readonly min?: string;
  readonly max?: string;
}

export const FIELD_FILTER_LIMITS = { maxFilters: 5, maxValues: 30, maxValue: 200 } as const;

export type FieldFiltersRead = { readonly ok: true; readonly filters: FieldFilter[] } | { readonly ok: false; readonly message: string };

const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");

/** Lee los filtros sin confiar en ellos (vienen de la web, de una difusión guardada o de un agente). Ausente: ninguno. */
export function readFieldFilters(value: unknown): FieldFiltersRead {
  if (value === undefined || value === null) return { ok: true, filters: [] };
  if (!Array.isArray(value)) return { ok: false, message: "Los filtros por campo deben ser una lista." };
  if (value.length > FIELD_FILTER_LIMITS.maxFilters) return { ok: false, message: `Usa hasta ${FIELD_FILTER_LIMITS.maxFilters} filtros por campo.` };
  const filters: FieldFilter[] = [];
  for (const raw of value) {
    const item = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const key = text(item["key"]);
    const op = item["op"];
    if (!CONTACT_FIELD_KEY_PATTERN.test(key)) return { ok: false, message: "Un filtro no dice qué campo usa." };
    if (typeof op !== "string" || !(FIELD_FILTER_OPS as ReadonlyArray<string>).includes(op)) return { ok: false, message: `El filtro de «${key}» no es válido.` };
    if (op === "in") {
      const values = (Array.isArray(item["values"]) ? item["values"] : []).map(text).filter(Boolean).map((entry) => entry.slice(0, FIELD_FILTER_LIMITS.maxValue));
      if (values.length === 0) return { ok: false, message: `Elige al menos un valor para «${key}».` };
      if (values.length > FIELD_FILTER_LIMITS.maxValues) return { ok: false, message: `Elige hasta ${FIELD_FILTER_LIMITS.maxValues} valores para «${key}».` };
      filters.push({ key, op, values: [...new Set(values)] });
    } else if (op === "between") {
      const [min, max] = [text(item["min"]), text(item["max"])];
      if (!min && !max) return { ok: false, message: `Escribe desde o hasta para «${key}».` };
      const dates = [min, max].filter(Boolean).every((edge) => /^\d{4}-\d{2}-\d{2}$/.test(edge) && parseFieldDate(edge) !== undefined);
      const numbers = [min, max].filter(Boolean).every((edge) => parseFieldNumber(edge) !== undefined);
      if (!dates && !numbers) return { ok: false, message: `«${key}»: usa dos números o dos fechas.` };
      filters.push({ key, op, ...(min ? { min } : {}), ...(max ? { max } : {}) });
    } else {
      filters.push({ key, op: op as FieldFilterOp });
    }
  }
  return { ok: true, filters };
}

/** Los bordes de un `between`, ya leídos: fechas (texto AAAA-MM-DD) o números. */
export function betweenEdges(filter: FieldFilter): { readonly kind: "date"; readonly min?: string; readonly max?: string } | { readonly kind: "number"; readonly min?: number; readonly max?: number } {
  const isDate = [filter.min, filter.max].some((edge) => edge !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(edge));
  if (isDate) return { kind: "date", ...(filter.min ? { min: filter.min } : {}), ...(filter.max ? { max: filter.max } : {}) };
  const [min, max] = [parseFieldNumber(filter.min ?? ""), parseFieldNumber(filter.max ?? "")];
  return { kind: "number", ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

/** ¿El cliente cumple TODOS los filtros? (La misma regla que el SQL; la usan los repositorios en memoria y las pruebas.) */
export function matchesFieldFilters(fields: Readonly<Record<string, ContactFieldValue>>, filters: ReadonlyArray<FieldFilter>): boolean {
  return filters.every((filter) => {
    const value = fields[filter.key];
    const filled = value !== undefined && value !== null && String(value) !== "";
    switch (filter.op) {
      case "filled":
        return filled;
      case "empty":
        return !filled;
      case "yes":
        return value === true;
      case "no":
        return value === false;
      case "in":
        return filled && (filter.values ?? []).some((accepted) => accepted.toLowerCase() === String(value).toLowerCase());
      case "between": {
        const edges = betweenEdges(filter);
        if (edges.kind === "date") {
          return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && (edges.min === undefined || value >= edges.min) && (edges.max === undefined || value <= edges.max);
        }
        return typeof value === "number" && (edges.min === undefined || value >= edges.min) && (edges.max === undefined || value <= edges.max);
      }
    }
  });
}
