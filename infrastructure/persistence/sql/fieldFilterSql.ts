import { betweenEdges, type FieldFilter } from "../../../contracts/ContactFieldFilters";

// ---------------------------------------------------------------------------
// Los filtros por Campo del cliente (`contracts/ContactFieldFilters.ts`) como
// condiciones SQL sobre el JSON del contacto. La MISMA regla que
// `matchesFieldFilters` (memoria y pruebas). Los valores van siempre como
// parámetros; la clave también (nunca se pega texto del usuario en el SQL).
// ---------------------------------------------------------------------------

/**
 * @param column la columna jsonb del contacto, con su alias (`ct.custom_fields`)
 * @param params los parámetros de la consulta: se agregan los de cada filtro
 * @returns una condición por filtro (se unen con `and`)
 */
export function fieldFilterSql(filters: ReadonlyArray<FieldFilter>, column: string, params: unknown[]): string[] {
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  return filters.map((filter) => {
    const key = `${add(filter.key)}::text`;
    const text = `(${column} ->> ${key})`;
    switch (filter.op) {
      case "filled":
        return `coalesce(${text}, '') <> ''`;
      case "empty":
        return `coalesce(${text}, '') = ''`;
      case "yes":
        return `(${column} -> ${key}) = 'true'::jsonb`;
      case "no":
        return `(${column} -> ${key}) = 'false'::jsonb`;
      case "in":
        return `lower(${text}) = any(${add((filter.values ?? []).map((value) => value.toLowerCase()))}::text[])`;
      case "between": {
        const edges = betweenEdges(filter);
        if (edges.kind === "date") {
          return [`${text} ~ '^\\d{4}-\\d{2}-\\d{2}$'`, ...(edges.min !== undefined ? [`${text} >= ${add(edges.min)}`] : []), ...(edges.max !== undefined ? [`${text} <= ${add(edges.max)}`] : [])].join(" and ");
        }
        // El `case` evita convertir a número un dato que no lo es (el orden de un `and` no está garantizado).
        const number = `(case when jsonb_typeof(${column} -> ${key}) = 'number' then ${text}::numeric end)`;
        return [`${number} is not null`, ...(edges.min !== undefined ? [`${number} >= ${add(edges.min)}::numeric`] : []), ...(edges.max !== undefined ? [`${number} <= ${add(edges.max)}::numeric`] : [])].join(" and ");
      }
    }
  });
}
