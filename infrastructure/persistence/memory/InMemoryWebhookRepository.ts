import { randomUUID } from "node:crypto";
import type { WebhookDelivery } from "../../../contracts/WebhookContracts";
import type { InboundWebhook } from "../../../domains/webhooks/domain/InboundWebhook";
import type { NewDelivery, WebhookRepository } from "../../../domains/webhooks/application/ports";

/** Webhooks de entrada en memoria (pruebas y desarrollo sin base). */
export class InMemoryWebhookRepository implements WebhookRepository {
  public readonly webhooks = new Map<string, InboundWebhook>();
  public readonly deliveryLog: Array<NewDelivery & { readonly id: string }> = [];

  public async list(tenantId: string) {
    return [...this.webhooks.values()].filter((webhook) => webhook.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findById(tenantId: string, id: string) {
    const webhook = this.webhooks.get(id);
    return webhook && webhook.tenantId === tenantId ? webhook : null;
  }

  public async findForDelivery(id: string) {
    return this.webhooks.get(id) ?? null;
  }

  public async create(webhook: InboundWebhook) {
    this.webhooks.set(webhook.id, webhook);
  }

  public async update(webhook: InboundWebhook) {
    const current = this.webhooks.get(webhook.id);
    if (current && current.tenantId === webhook.tenantId) this.webhooks.set(webhook.id, { ...webhook, sample: current.sample, sampleReceivedAt: current.sampleReceivedAt });
  }

  public async remove(tenantId: string, id: string) {
    const current = this.webhooks.get(id);
    if (!current || current.tenantId !== tenantId) return false;
    this.webhooks.delete(id);
    return true;
  }

  public async saveSample(tenantId: string, id: string, sample: unknown, receivedAt: string) {
    const current = this.webhooks.get(id);
    if (current && current.tenantId === tenantId) this.webhooks.set(id, { ...current, sample, sampleReceivedAt: receivedAt });
  }

  public async recordDelivery(delivery: NewDelivery) {
    this.deliveryLog.push({ ...delivery, id: randomUUID() });
  }

  public async deliveries(tenantId: string, webhookId: string, limit: number): Promise<WebhookDelivery[]> {
    return this.deliveryLog
      .filter((delivery) => delivery.tenantId === tenantId && delivery.webhookId === webhookId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, limit)
      .map(({ id, receivedAt, outcome, phone, contactId, flowStarted, notes, error, payload }) => ({ id, receivedAt, outcome, phone, contactId, flowStarted, notes, error, payload }));
  }

  public async usage(tenantId: string, since: string) {
    const usage = new Map<string, { count: number; lastReceivedAt: string | null }>();
    for (const delivery of this.deliveryLog.filter((item) => item.tenantId === tenantId)) {
      const current = usage.get(delivery.webhookId) ?? { count: 0, lastReceivedAt: null };
      usage.set(delivery.webhookId, {
        count: current.count + (delivery.receivedAt >= since ? 1 : 0),
        lastReceivedAt: !current.lastReceivedAt || delivery.receivedAt > current.lastReceivedAt ? delivery.receivedAt : current.lastReceivedAt
      });
    }
    return usage;
  }
}
