import type { GroupMemberFilter } from "../../../contracts/GroupMemberContracts";
import type { GroupMemberReader, MemberPage, MemberQuery, MemberRow } from "../../../domains/groups/application/GroupMemberPorts";
import type { SqlClient } from "./SqlClient";
import { SALES_OF_MEMBERS } from "./sqlGroupSales";
import { toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// SqlGroupMembers — los miembros de un grupo (`wa_group_members`) con su
// nombre (si es contacto), si es uno de tus números y lo que compró mientras
// estaba (`SALES_OF_MEMBERS`, la misma regla que los números del grupo).
//
// Parámetros de `PEOPLE`: $1 cuenta, $2 grupo, $3 desde (siempre `null`: todo),
// $4 texto a buscar en el nombre (escapado), $5 dígitos a buscar en el número.
// ---------------------------------------------------------------------------

const PEOPLE = `with own as (
    select phone_number from whatsapp_connections where tenant_id = $1 and phone_number is not null
  ), sold as (
    select y.phone, y.currency, sum(y.amount) as amount
      from (select distinct x.sale_id, x.phone, x.currency, x.amount from (${SALES_OF_MEMBERS} and m.group_id = $2::uuid) x) y
     group by y.phone, y.currency
  ), people as (
    select m.member_key, m.phone, m.is_admin, m.source, m.joined_at, m.left_at, c.id as contact_id, c.name,
           m.phone in (select phone_number from own) as own,
           exists (select 1 from sold b where b.phone = m.phone) as buyer
      from wa_group_members m
      left join contacts c on c.tenant_id = m.tenant_id and c.channel = 'whatsapp' and c.external_key = m.phone
     where m.tenant_id = $1 and m.group_id = $2::uuid and m.phone is not null
       and ($4::text is null or c.name ilike '%' || $4 || '%' escape '\\' or ($5::text is not null and m.phone like '%' || $5 || '%'))
  )`;

const WHERE: Readonly<Record<GroupMemberFilter, string>> = {
  all: "p.left_at is null",
  buyers: "p.buyer",
  nonBuyers: "p.left_at is null and not p.buyer and not p.own",
  left: "p.left_at is not null",
  admins: "p.left_at is null and p.is_admin"
};

interface Row {
  member_key: string;
  phone: string;
  is_admin: boolean;
  source: string;
  joined_at: Date | string;
  left_at: Date | string | null;
  contact_id: string | null;
  name: string | null;
  own: boolean;
  bought: ReadonlyArray<{ currency: string; amount: number | string }>;
}

interface Counts {
  everyone: string;
  buyers: string;
  non_buyers: string;
  gone: string;
  admins: string;
  hidden: string;
}

const toMember = (row: Row): MemberRow => ({
  key: row.member_key,
  name: row.name,
  phone: row.phone,
  contactId: row.contact_id,
  isAdmin: row.is_admin,
  isOwnNumber: row.own,
  joinedAt: row.source === "event" ? toIso(row.joined_at) : null,
  leftAt: row.left_at === null ? null : toIso(row.left_at),
  bought: row.bought.map((entry) => ({ currency: entry.currency, amount: Number(entry.amount) }))
});

/** El texto para `ilike` sin comodines propios: «50%» busca «50%», no «50…». */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/** $4 y $5: la búsqueda en el nombre y, si trae al menos 3 dígitos, en el número. */
function searchParams(search: string | null): [string | null, string | null] {
  if (!search) return [null, null];
  const digits = search.replace(/\D/g, "");
  return [escapeLike(search), digits.length >= 3 ? digits : null];
}

export class SqlGroupMembers implements GroupMemberReader {
  public constructor(private readonly sql: SqlClient) {}

  public async page(tenantId: string, groupId: string, query: MemberQuery): Promise<MemberPage> {
    const params = [tenantId, groupId, null, ...searchParams(query.search)];
    const [rows, counts] = await Promise.all([
      this.sql.query<Row>(
        `${PEOPLE}
         select p.*, coalesce((select json_agg(json_build_object('currency', b.currency, 'amount', b.amount) order by b.amount desc) from sold b where b.phone = p.phone), '[]'::json) as bought
           from people p where ${WHERE[query.filter]}
          order by coalesce(p.left_at, case when p.source = 'event' then p.joined_at end) desc nulls last, p.member_key
          limit $6 offset $7`,
        [...params, query.limit, query.offset]
      ),
      this.sql.query<Counts>(
        `${PEOPLE}
         select count(*) filter (where ${WHERE.all}) as everyone, count(*) filter (where ${WHERE.buyers}) as buyers,
                count(*) filter (where ${WHERE.nonBuyers}) as non_buyers, count(*) filter (where ${WHERE.left}) as gone,
                count(*) filter (where ${WHERE.admins}) as admins,
                (select count(*) from wa_group_members h where h.tenant_id = $1 and h.group_id = $2::uuid and h.phone is null and h.left_at is null) as hidden
           from people p`,
        params
      )
    ]);
    const total = counts.rows[0];
    const n = (value: string | undefined) => Number(value ?? 0);
    return {
      rows: rows.rows.map(toMember),
      counts: { all: n(total?.everyone), buyers: n(total?.buyers), nonBuyers: n(total?.non_buyers), left: n(total?.gone), admins: n(total?.admins) },
      hidden: n(total?.hidden)
    };
  }

  public async toLabel(tenantId: string, groupId: string, filter: GroupMemberFilter, label: string, limit: number): Promise<{ readonly phones: ReadonlyArray<string>; readonly total: number }> {
    const result = await this.sql.query<{ phone: string; total: string }>(
      `${PEOPLE}
       select x.phone, count(*) over () as total
         from (select distinct p.phone from people p
                where ${WHERE[filter]} and not p.own
                  and not exists (select 1 from contact_label_assignments a
                                    join contact_labels l on l.tenant_id = a.tenant_id and l.id = a.label_id
                                   where a.tenant_id = $1 and a.contact_id = p.contact_id and lower(l.name) = lower($6))) x
        order by x.phone limit $7`,
      [tenantId, groupId, null, null, null, label, limit]
    );
    return { phones: result.rows.map((row) => row.phone), total: Number(result.rows[0]?.total ?? 0) };
  }
}
