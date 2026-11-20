import type { PushTopic } from "../../../contracts/NotificationSettingsContracts";
import type { PushDeviceStore, PushPreferenceStore, StoredPushDevice } from "../../../domains/notifications/application/PushPorts";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// Los dispositivos con avisos y lo que le suena a cada persona (`057_push_notifications.sql`).

interface DeviceRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
  created_at: Date | string;
  last_used_at: Date | string | null;
}

const toDevice = (row: DeviceRow): StoredPushDevice => ({
  id: row.id,
  userId: row.user_id,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
  label: row.label,
  createdAt: toIso(row.created_at),
  lastUsedAt: row.last_used_at === null ? null : toIso(row.last_used_at)
});

const MAX_DEVICES = 20;

export class SqlPushDevices implements PushDeviceStore {
  public constructor(private readonly sql: SqlClient) {}

  public async save(device: { readonly userId: string; readonly endpoint: string; readonly p256dh: string; readonly auth: string; readonly label: string }): Promise<string> {
    // El mismo navegador vuelve a suscribirse (o cambió de persona): se actualiza, nunca se duplica.
    const result = await this.sql.query<{ id: string }>(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth, label) values ($1, $2, $3, $4, $5)
       on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label
       returning id`,
      [device.userId, device.endpoint, device.p256dh, device.auth, device.label]
    );
    return result.rows[0]!.id;
  }

  public async listForUser(userId: string): Promise<ReadonlyArray<StoredPushDevice>> {
    if (!isUuid(userId)) return [];
    const result = await this.sql.query<DeviceRow>("select * from push_subscriptions where user_id = $1 order by created_at desc limit $2", [userId, MAX_DEVICES]);
    return result.rows.map(toDevice);
  }

  public async listForUsers(userIds: ReadonlyArray<string>): Promise<ReadonlyArray<StoredPushDevice>> {
    const ids = userIds.filter(isUuid);
    if (ids.length === 0) return [];
    const result = await this.sql.query<DeviceRow>("select * from push_subscriptions where user_id = any($1::uuid[])", [ids]);
    return result.rows.map(toDevice);
  }

  public async remove(userId: string, deviceId: string): Promise<boolean> {
    if (!isUuid(userId) || !isUuid(deviceId)) return false;
    const result = await this.sql.query("delete from push_subscriptions where user_id = $1 and id = $2", [userId, deviceId]);
    return (result.rowCount ?? 0) > 0;
  }

  public async forget(deviceId: string): Promise<void> {
    if (isUuid(deviceId)) await this.sql.query("delete from push_subscriptions where id = $1", [deviceId]);
  }

  public async touch(deviceId: string, at: Date): Promise<void> {
    if (isUuid(deviceId)) await this.sql.query("update push_subscriptions set last_used_at = $2 where id = $1", [deviceId, at]);
  }
}

export class SqlPushPreferences implements PushPreferenceStore {
  public constructor(private readonly sql: SqlClient) {}

  public async get(tenantId: string, userId: string): Promise<ReadonlyMap<PushTopic, boolean>> {
    if (!isUuid(tenantId) || !isUuid(userId)) return new Map();
    const result = await this.sql.query<{ topic: PushTopic; enabled: boolean }>("select topic, enabled from notification_preferences where tenant_id = $1 and user_id = $2", [tenantId, userId]);
    return new Map(result.rows.map((row) => [row.topic, row.enabled]));
  }

  public async set(tenantId: string, userId: string, topic: PushTopic, enabled: boolean, at: Date): Promise<void> {
    await this.sql.query(
      `insert into notification_preferences (tenant_id, user_id, topic, enabled, updated_at) values ($1, $2, $3, $4, $5)
       on conflict (tenant_id, user_id, topic) do update set enabled = excluded.enabled, updated_at = excluded.updated_at`,
      [tenantId, userId, topic, enabled, at]
    );
  }

  public async mutedAmong(tenantId: string, topic: PushTopic, userIds: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
    const ids = userIds.filter(isUuid);
    if (ids.length === 0 || !isUuid(tenantId)) return new Set();
    const result = await this.sql.query<{ user_id: string }>(
      "select user_id from notification_preferences where tenant_id = $1 and topic = $2 and enabled = false and user_id = any($3::uuid[])",
      [tenantId, topic, ids]
    );
    return new Set(result.rows.map((row) => row.user_id));
  }
}
