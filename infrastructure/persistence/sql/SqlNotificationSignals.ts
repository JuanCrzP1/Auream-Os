import type { NotificationKind } from "../../../contracts/NotificationContracts";
import type { SignalQuery, SignalSource } from "../../../domains/notifications/application/NotificationPorts";
import { RECENT_GROUP_DAYS, type Signal } from "../../../domains/notifications/domain/Signal";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// La campana lee el estado de cada módulo, solo lo que la persona puede ver:
//   · números desconectados                       (whatsapp_connections)
//   · difusiones que se pausaron solas            (broadcasts)
//   · ventas por revisar, en un solo aviso         (sales)
//   · MIS seguimientos de hoy o vencidos           (crm_follow_ups, día del negocio)
//   · grupos que abrió una campaña esta semana     (wa_groups + group_campaigns)
// ---------------------------------------------------------------------------

type Reader = (sql: SqlClient, query: SignalQuery) => Promise<ReadonlyArray<Signal>>;

const READERS: Record<NotificationKind, Reader> = {
  number_disconnected: async (sql, { tenantId }) => {
    const rows = (await sql.query<{ id: string; name: string; at: Date }>(
      `select id, name, updated_at as at from whatsapp_connections
        where tenant_id = $1 and deleted_at is null and status = 'disconnected'`,
      [tenantId]
    )).rows;
    return rows.map((row) => ({ kind: "number_disconnected", id: row.id, name: row.name, at: new Date(row.at) }));
  },
  broadcast_auto_paused: async (sql, { tenantId }) => {
    const rows = (await sql.query<{ id: string; name: string; reason: string | null; at: Date }>(
      `select id, name, status_reason as reason, updated_at as at from broadcasts
        where tenant_id = $1 and status = 'auto_paused'`,
      [tenantId]
    )).rows;
    return rows.map((row) => ({ kind: "broadcast_auto_paused", id: row.id, name: row.name, reason: row.reason, at: new Date(row.at) }));
  },
  sales_review: async (sql, { tenantId }) => {
    const row = (await sql.query<{ count: string; at: Date | null }>(
      `select count(*) as count, max(created_at) as at from sales where tenant_id = $1 and status = 'review'`,
      [tenantId]
    )).rows[0];
    const count = Number(row?.count ?? 0);
    return count > 0 && row?.at ? [{ kind: "sales_review", count, at: new Date(row.at) }] : [];
  },
  follow_ups_due: async (sql, { tenantId, userId, timezone, now }) => {
    const row = (await sql.query<{ count: string; overdue: string; at: Date | null }>(
      `select count(*) as count,
              count(*) filter (where due_at < $3) as overdue,
              -- Nuevo cuando vence otro, o al empezar el día (no a cada revisión).
              coalesce(max(due_at) filter (where due_at <= $3), date_trunc('day', $3::timestamptz at time zone $4) at time zone $4) as at
         from crm_follow_ups
        where tenant_id = $1 and assignee_id = $2 and done_at is null
          and due_at < (date_trunc('day', $3::timestamptz at time zone $4) + interval '1 day') at time zone $4`,
      [tenantId, userId, now, timezone]
    )).rows[0];
    const count = Number(row?.count ?? 0);
    return count > 0 && row?.at ? [{ kind: "follow_ups_due", count, overdue: Number(row.overdue), at: new Date(row.at) }] : [];
  },
  group_created: async (sql, { tenantId, now }) => {
    const rows = (await sql.query<{ id: string; campaign_id: string; campaign: string; name: string; at: Date }>(
      `select g.id, g.campaign_id, c.name as campaign, g.name, g.created_at as at
         from wa_groups g join group_campaigns c on c.id = g.campaign_id
        where g.tenant_id = $1 and g.removed_at is null and g.position > 1
          and g.created_at > $2::timestamptz - make_interval(days => $3)`,
      [tenantId, now, RECENT_GROUP_DAYS]
    )).rows;
    return rows.map((row) => ({ kind: "group_created", id: row.id, campaignId: row.campaign_id, campaign: row.campaign, group: row.name, at: new Date(row.at) }));
  }
};

export class SqlNotificationSignals implements SignalSource {
  public constructor(private readonly sql: SqlClient) {}

  public async read(query: SignalQuery): Promise<ReadonlyArray<Signal>> {
    const lists = await Promise.all([...query.kinds].map((kind) => READERS[kind](this.sql, query)));
    return lists.flat();
  }
}
