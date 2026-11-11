import type { Candidate, RecipientRecord, RecipientStore } from "../../../domains/broadcasts/application/BroadcastPorts";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlBroadcastRecipients — `broadcast_recipients` (034): la lista de cada
// difusión y el avance de cada número. Tomar el siguiente es atómico
// (`for update skip locked`): dos rondas nunca le envían al mismo cliente.
// ---------------------------------------------------------------------------

const CHUNK = 1000;
/** Cuántos días atrás se miran para el calentamiento. */
const WARMUP_LOOKBACK_DAYS = 60;

interface ClaimRow {
  readonly id: string;
  readonly contact_id: string | null;
  readonly name: string | null;
  readonly phone: string;
  readonly connection_id: string;
  readonly variant: number;
}

export class SqlBroadcastRecipients implements RecipientStore {
  public constructor(private readonly sql: SqlClient) {}

  public async insert(tenantId: string, broadcastId: string, recipients: ReadonlyArray<Candidate & { readonly variant: number | null }>): Promise<number> {
    let inserted = 0;
    for (let start = 0; start < recipients.length; start += CHUNK) {
      const chunk = recipients.slice(start, start + CHUNK);
      const result = await this.sql.query(
        `insert into broadcast_recipients (tenant_id, broadcast_id, contact_id, name, phone, connection_id, variant, position)
         select $1, $2, r.contact_id, r.name, r.phone, r.connection_id, r.variant, r.position
           from unnest($3::uuid[], $4::text[], $5::text[], $6::uuid[], $7::int[], $8::int[]) as r(contact_id, name, phone, connection_id, variant, position)
         on conflict (broadcast_id, phone) do nothing`,
        [
          tenantId,
          broadcastId,
          chunk.map((item) => item.contactId),
          chunk.map((item) => item.name),
          chunk.map((item) => item.phone),
          chunk.map((item) => item.connectionId),
          chunk.map((item) => item.variant),
          chunk.map((_, index) => start + index)
        ]
      );
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  }

  public async claimNext(tenantId: string, broadcastId: string, connectionId: string, now: Date): Promise<RecipientRecord | null> {
    const result = await this.sql.query<ClaimRow>(
      `update broadcast_recipients set status = 'sending', claimed_at = $4
        where id = (select id from broadcast_recipients
                     where tenant_id = $1 and broadcast_id = $2 and connection_id = $3 and status = 'pending' and variant is not null
                     order by position limit 1 for update skip locked)
        returning id, contact_id, name, phone, connection_id, variant`,
      [tenantId, broadcastId, connectionId, now]
    );
    const row = result.rows[0];
    return row ? { id: row.id, contactId: row.contact_id, name: row.name, phone: row.phone, connectionId: row.connection_id, variant: row.variant } : null;
  }

  public async finish(tenantId: string, recipientId: string, outcome: Parameters<RecipientStore["finish"]>[2]): Promise<void> {
    await this.sql.query(
      `update broadcast_recipients
          set status = $3, provider_message_id = $4, error = $5, sent_at = case when $3 = 'sent' then $6::timestamptz else null end
        where tenant_id = $1 and id = $2`,
      [tenantId, recipientId, outcome.status, outcome.providerMessageId, outcome.error ? outcome.error.slice(0, 300) : null, outcome.at]
    );
  }

  public async expireStale(tenantId: string, broadcastId: string, before: Date): Promise<number> {
    const result = await this.sql.query(
      `update broadcast_recipients set status = 'failed', error = 'No se confirmó el envío (se cortó a la mitad); no se reintenta para no duplicarlo.'
        where tenant_id = $1 and broadcast_id = $2 and status = 'sending' and claimed_at < $3`,
      [tenantId, broadcastId, before]
    );
    return result.rowCount ?? 0;
  }

  public async attempts(tenantId: string, broadcastId: string): Promise<{ readonly attempted: number; readonly failed: number }> {
    const result = await this.sql.query<{ attempted: string; failed: string }>(
      `select count(*) filter (where status in ('sent', 'failed')) as attempted, count(*) filter (where status = 'failed') as failed
         from broadcast_recipients where tenant_id = $1 and broadcast_id = $2`,
      [tenantId, broadcastId]
    );
    return { attempted: Number(result.rows[0]?.attempted ?? 0), failed: Number(result.rows[0]?.failed ?? 0) };
  }

  public async work(tenantId: string, broadcastId: string) {
    const result = await this.sql.query<{ connection_id: string; pending: string; held: string; in_flight: string }>(
      `select connection_id,
              count(*) filter (where status = 'pending' and variant is not null) as pending,
              count(*) filter (where status = 'pending' and variant is null) as held,
              count(*) filter (where status = 'sending') as in_flight
         from broadcast_recipients
        where tenant_id = $1 and broadcast_id = $2 and status in ('pending', 'sending')
        group by connection_id`,
      [tenantId, broadcastId]
    );
    return {
      pendingByConnection: result.rows.filter((row) => Number(row.pending) > 0).map((row) => row.connection_id),
      held: result.rows.reduce((total, row) => total + Number(row.held), 0),
      inFlight: result.rows.reduce((total, row) => total + Number(row.in_flight), 0)
    };
  }

  public async assignHeld(tenantId: string, broadcastId: string, variant: number): Promise<number> {
    const result = await this.sql.query(
      "update broadcast_recipients set variant = $3 where tenant_id = $1 and broadcast_id = $2 and status = 'pending' and variant is null",
      [tenantId, broadcastId, variant]
    );
    return result.rowCount ?? 0;
  }

  public async cancelPending(tenantId: string, broadcastId: string): Promise<number> {
    const result = await this.sql.query("update broadcast_recipients set status = 'cancelled' where tenant_id = $1 and broadcast_id = $2 and status = 'pending'", [tenantId, broadcastId]);
    return result.rowCount ?? 0;
  }

  public async sentSince(tenantId: string, connectionId: string, since: Date): Promise<number> {
    const result = await this.sql.query<{ total: string }>(
      "select count(*) as total from broadcast_recipients where tenant_id = $1 and connection_id = $2 and status = 'sent' and sent_at >= $3",
      [tenantId, connectionId, since]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  public async daysWithSends(tenantId: string, connectionId: string, timezone: string): Promise<number> {
    const result = await this.sql.query<{ days: string }>(
      `select count(distinct (sent_at at time zone $3)::date) as days
         from broadcast_recipients
        where tenant_id = $1 and connection_id = $2 and status = 'sent' and sent_at >= now() - make_interval(days => $4)`,
      [tenantId, connectionId, timezone, WARMUP_LOOKBACK_DAYS]
    );
    return Number(result.rows[0]?.days ?? 0);
  }
}
