import { readWebhookMapping, WEBHOOK_LIMITS, type WebhookDelivery, type WebhookDeliveryOutcome } from "../../../contracts/WebhookContracts";
import type { InboundWebhook } from "../../../domains/webhooks/domain/InboundWebhook";
import type { NewDelivery, WebhookRepository } from "../../../domains/webhooks/application/ports";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Webhooks de entrada en Neon (`024_inbound_webhooks.sql`). El historial
// guarda cada envío (recortado si es enorme) 30 días; cada tanto borra lo viejo.
// ---------------------------------------------------------------------------

const COLUMNS = "id, tenant_id, name, enabled, connection_id, secret_envelope, mapping, sample, sample_received_at, created_at, updated_at";
const HISTORY_RETENTION_MS = 30 * 86_400_000;
const SWEEP_EVERY = 100;

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly connection_id: string | null;
  readonly secret_envelope: string;
  readonly mapping: unknown;
  readonly sample: unknown;
  readonly sample_received_at: Date | string | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

function toWebhook(row: Row): InboundWebhook {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    enabled: row.enabled,
    connectionId: row.connection_id,
    secretEnvelope: row.secret_envelope,
    mapping: readWebhookMapping(row.mapping),
    sample: row.sample ?? null,
    sampleReceivedAt: row.sample_received_at ? toIso(row.sample_received_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/** El envío tal cual, o un aviso si es demasiado grande para guardarlo. */
function storable(payload: unknown): string {
  const json = JSON.stringify(payload ?? null);
  return Buffer.byteLength(json) <= WEBHOOK_LIMITS.payloadBytes ? json : JSON.stringify({ aviso: "El envío era demasiado grande para guardarlo completo." });
}

export class SqlWebhookRepository implements WebhookRepository {
  private recorded = 0;

  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<InboundWebhook[]> {
    const result = await this.sql.query<Row>(`select ${COLUMNS} from inbound_webhooks where tenant_id = $1 order by created_at`, [tenantId]);
    return result.rows.map(toWebhook);
  }

  public async findById(tenantId: string, id: string): Promise<InboundWebhook | null> {
    if (!isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from inbound_webhooks where tenant_id = $1 and id = $2`, [tenantId, id]);
    return result.rows[0] ? toWebhook(result.rows[0]) : null;
  }

  public async findForDelivery(id: string): Promise<InboundWebhook | null> {
    if (!isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from inbound_webhooks where id = $1`, [id]);
    return result.rows[0] ? toWebhook(result.rows[0]) : null;
  }

  public async create(webhook: InboundWebhook): Promise<void> {
    await this.sql.query(
      `insert into inbound_webhooks (${COLUMNS}) values ($1, $2, $3, $4, $5, $6, $7::jsonb, null, null, $8, $9)`,
      [webhook.id, webhook.tenantId, webhook.name, webhook.enabled, webhook.connectionId, webhook.secretEnvelope, JSON.stringify(webhook.mapping), webhook.createdAt, webhook.updatedAt]
    );
  }

  public async update(webhook: InboundWebhook): Promise<void> {
    await this.sql.query(
      `update inbound_webhooks set name = $3, enabled = $4, connection_id = $5, mapping = $6::jsonb, updated_at = $7 where tenant_id = $1 and id = $2`,
      [webhook.tenantId, webhook.id, webhook.name, webhook.enabled, webhook.connectionId, JSON.stringify(webhook.mapping), webhook.updatedAt]
    );
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    return (await this.sql.query("delete from inbound_webhooks where tenant_id = $1 and id = $2", [tenantId, id])).rowCount > 0;
  }

  public async saveSample(tenantId: string, id: string, sample: unknown, receivedAt: string): Promise<void> {
    await this.sql.query("update inbound_webhooks set sample = $3::jsonb, sample_received_at = $4 where tenant_id = $1 and id = $2", [tenantId, id, storable(sample), receivedAt]);
  }

  public async recordDelivery(delivery: NewDelivery): Promise<void> {
    await this.sql.query(
      `insert into inbound_webhook_deliveries (tenant_id, webhook_id, received_at, outcome, phone, contact_id, flow_started, notes, error, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb)`,
      [delivery.tenantId, delivery.webhookId, delivery.receivedAt, delivery.outcome, delivery.phone, delivery.contactId, delivery.flowStarted, JSON.stringify(delivery.notes), delivery.error, storable(delivery.payload)]
    );
    this.recorded += 1;
    if (this.recorded % SWEEP_EVERY === 0) {
      await this.sql.query("delete from inbound_webhook_deliveries where received_at < $1", [new Date(Date.now() - HISTORY_RETENTION_MS).toISOString()]).catch(() => undefined);
    }
  }

  public async deliveries(tenantId: string, webhookId: string, limit: number): Promise<WebhookDelivery[]> {
    const result = await this.sql.query<{ id: string; received_at: Date | string; outcome: WebhookDeliveryOutcome; phone: string | null; contact_id: string | null; flow_started: boolean; notes: string[]; error: string | null; payload: unknown }>(
      `select id, received_at, outcome, phone, contact_id, flow_started, notes, error, payload from inbound_webhook_deliveries
        where tenant_id = $1 and webhook_id = $2 order by received_at desc limit $3`,
      [tenantId, webhookId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      receivedAt: toIso(row.received_at),
      outcome: row.outcome,
      phone: row.phone,
      contactId: row.contact_id,
      flowStarted: row.flow_started,
      notes: row.notes ?? [],
      error: row.error,
      payload: row.payload ?? null
    }));
  }

  public async usage(tenantId: string, since: string): Promise<Map<string, { count: number; lastReceivedAt: string | null }>> {
    const result = await this.sql.query<{ webhook_id: string; count: number; last: Date | string | null }>(
      `select webhook_id, count(*) filter (where received_at >= $2)::int as count, max(received_at) as last
         from inbound_webhook_deliveries where tenant_id = $1 group by webhook_id`,
      [tenantId, since]
    );
    return new Map(result.rows.map((row) => [row.webhook_id, { count: Number(row.count), lastReceivedAt: row.last ? toIso(row.last) : null }]));
  }
}
