import type { NotificationReads } from "../../../domains/notifications/application/NotificationPorts";
import type { SqlClient } from "./SqlClient";

/** Hasta cuándo vio cada persona sus avisos (`notification_reads`). */
export class SqlNotificationReads implements NotificationReads {
  public constructor(private readonly sql: SqlClient) {}

  public async seenAt(tenantId: string, userId: string): Promise<Date | null> {
    const row = (await this.sql.query<{ seen_at: Date }>("select seen_at from notification_reads where tenant_id = $1 and user_id = $2", [tenantId, userId])).rows[0];
    return row ? new Date(row.seen_at) : null;
  }

  public async markSeen(tenantId: string, userId: string, at: Date): Promise<void> {
    await this.sql.query(
      `insert into notification_reads (tenant_id, user_id, seen_at) values ($1, $2, $3)
       on conflict (tenant_id, user_id) do update set seen_at = greatest(notification_reads.seen_at, excluded.seen_at)`,
      [tenantId, userId, at]
    );
  }
}
