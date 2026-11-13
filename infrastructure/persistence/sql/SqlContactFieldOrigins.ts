import type { FieldOrigins, OriginWrite, StoredOrigin } from "../../../domains/contact-fields/application/ContactFieldPorts";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// De dónde salió el dato de cada cliente (`contact_field_origins`): una fila
// por cliente y clave, con el último origen. Todo filtra por cuenta.
// ---------------------------------------------------------------------------

interface Row {
  readonly key: string;
  readonly source: "flow" | "team";
  readonly flow_key: string | null;
  readonly actor_id: string | null;
  readonly updated_at: Date | string;
}

export class SqlContactFieldOrigins implements FieldOrigins {
  public constructor(private readonly sql: SqlClient) {}

  public async record(tenantId: string, contactId: string, keys: ReadonlyArray<string>, origin: OriginWrite): Promise<void> {
    if (!isUuid(contactId) || keys.length === 0) return;
    const flowKey = origin.source === "flow" ? origin.flowKey : null;
    const actorId = origin.source === "team" ? origin.actorId : null;
    await this.sql.query(
      `insert into contact_field_origins (tenant_id, contact_id, key, source, flow_key, actor_id, updated_at)
       select $1, c.id, k.key, $4, $5, $6, now() from contacts c cross join unnest($3::text[]) as k(key)
        where c.tenant_id = $1 and c.id = $2
       on conflict (contact_id, key) do update set source = excluded.source, flow_key = excluded.flow_key, actor_id = excluded.actor_id, updated_at = now()`,
      [tenantId, contactId, [...keys], origin.source, flowKey, actorId]
    );
  }

  public async forContact(tenantId: string, contactId: string): Promise<ReadonlyArray<StoredOrigin>> {
    if (!isUuid(contactId)) return [];
    const { rows } = await this.sql.query<Row>(
      `select key, source, flow_key, actor_id, updated_at from contact_field_origins where tenant_id = $1 and contact_id = $2`,
      [tenantId, contactId]
    );
    return rows.map((row) => ({ key: row.key, source: row.source, flowKey: row.flow_key, actorId: row.actor_id, at: toIso(row.updated_at) }));
  }

  public async forget(tenantId: string, contactId: string, keys: ReadonlyArray<string>): Promise<void> {
    if (!isUuid(contactId) || keys.length === 0) return;
    await this.sql.query(`delete from contact_field_origins where tenant_id = $1 and contact_id = $2 and key = any($3::text[])`, [tenantId, contactId, [...keys]]);
  }
}
