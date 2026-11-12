import type { BoardQuery } from "../../../domains/crm/application/CrmRepositories";

// ---------------------------------------------------------------------------
// Quién está en cada etapa del tablero (`f`), en dos partes:
//
//   compra actual       sale de las ETIQUETAS (la etapa es la etiqueta) y se
//                       une a su registro actual de `crm_deals`. Si alguien
//                       quedó con dos etapas del mismo embudo, cuenta en la
//                       más avanzada: nunca aparece dos veces.
//   compras anteriores  sus registros que ya no son los actuales, en la etapa
//                       donde terminaron (no se mueven).
//
// `$1` cuenta · `$2` embudo. Los filtros (responsable, búsqueda) van para las dos.
// ---------------------------------------------------------------------------

function filtersFor(alias: string, query: BoardQuery, ownerParam: number | null, searchParam: number | null): string {
  const filters: string[] = [];
  if (query.ownerId === "none") filters.push(`${alias}.owner_id is null`);
  else if (ownerParam !== null) filters.push(`${alias}.owner_id = $${ownerParam}`);
  if (searchParam !== null) filters.push(`(c.name ilike $${searchParam} or c.phone like $${searchParam})`);
  return filters.length > 0 ? ` and ${filters.join(" and ")}` : "";
}

/** Escapa `%`, `_` y `\` para buscar el texto tal cual con `ilike`. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export function membersSql(query: BoardQuery, params: unknown[]): string {
  let ownerParam: number | null = null;
  let searchParam: number | null = null;
  if (query.ownerId && query.ownerId !== "none") {
    params.push(query.ownerId);
    ownerParam = params.length;
  }
  if (query.search) {
    params.push(likePattern(query.search));
    searchParam = params.length;
  }
  return `with st as (select id, label_id, position from crm_stages where tenant_id = $1 and pipeline_id = $2),
               m as (select distinct on (a.contact_id) a.contact_id, st.id as stage_id, a.created_at as labeled_at
                       from contact_label_assignments a join st on st.label_id = a.label_id
                      where a.tenant_id = $1
                      order by a.contact_id, st.position desc),
               f as (select m.contact_id, m.stage_id, c.name, c.phone, d.amount, d.currency, d.product_name, d.owner_id,
                            case when d.stage_id = m.stage_id then d.stage_entered_at else m.labeled_at end as entered_at,
                            d.id as deal_id, coalesce(d.number, 1) as number, true as current
                       from m
                       join contacts c on c.tenant_id = $1 and c.id = m.contact_id
                       left join crm_deals d on d.pipeline_id = $2 and d.contact_id = m.contact_id and d.current
                      where true${filtersFor("d", query, ownerParam, searchParam)}
                     union all
                     select p.contact_id, p.stage_id, c.name, c.phone, p.amount, p.currency, p.product_name, p.owner_id,
                            p.stage_entered_at as entered_at, p.id as deal_id, p.number, false as current
                       from crm_deals p
                       join st on st.id = p.stage_id
                       join contacts c on c.tenant_id = $1 and c.id = p.contact_id
                      where p.tenant_id = $1 and p.pipeline_id = $2 and not p.current${filtersFor("p", query, ownerParam, searchParam)})`;
}
