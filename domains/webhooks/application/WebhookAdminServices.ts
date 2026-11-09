import { EMPTY_WEBHOOK_MAPPING, readWebhookMapping, type CreateWebhookRequest, type UpdateWebhookRequest, type WebhookDelivery, type WebhookDetail, type WebhookSummary } from "../../../contracts/WebhookContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { requireWebhookMapping, requireWebhookName, webhookSecretContext, type InboundWebhook } from "../domain/InboundWebhook";
import type { WebhookConnections, WebhookRepository } from "./ports";

// ---------------------------------------------------------------------------
// Administrar los webhooks de entrada de una cuenta: listarlos (con lo
// recibido en el mes), crearlos, verlos (con su dirección secreta y el último
// envío de ejemplo), editarlos, borrarlos y ver su historial.
//
// El secreto de la dirección se guarda CIFRADO (con el contexto del webhook)
// y la dirección se arma al mostrarla: `<base>/hooks/in/<id>/<secreto>`.
// ---------------------------------------------------------------------------

export const INBOUND_WEBHOOK_PATH = "/hooks/in";
const HISTORY_LIMIT = 50;

export interface WebhookAdminDependencies {
  readonly repository: WebhookRepository;
  readonly connections: WebhookConnections;
  readonly cipher: SecretCipher;
  /** Dirección pública de la API (sin barra final). */
  readonly publicBaseUrl: string;
  readonly newId: () => string;
  /** Secreto nuevo, sin adivinar (32 bytes, base64url). */
  readonly newSecret: () => string;
  readonly now?: () => Date;
}

const startOfMonth = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

export class WebhookAdminServices {
  private readonly now: () => Date;

  public constructor(private readonly deps: WebhookAdminDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  public async list(tenantId: string): Promise<WebhookSummary[]> {
    const [webhooks, usage] = await Promise.all([this.deps.repository.list(tenantId), this.deps.repository.usage(tenantId, startOfMonth(this.now()))]);
    return webhooks.map((webhook) => this.summary(webhook, usage.get(webhook.id)));
  }

  public async get(tenantId: string, id: string): Promise<WebhookDetail> {
    const webhook = await this.require(tenantId, id);
    const usage = await this.deps.repository.usage(tenantId, startOfMonth(this.now()));
    return this.detail(webhook, usage.get(id));
  }

  public async create(tenantId: string, request: CreateWebhookRequest): Promise<WebhookDetail> {
    const name = requireWebhookName(request.name);
    const connectionId = await this.requireConnection(tenantId, request.connectionId ?? null);
    const id = this.deps.newId();
    const at = this.now().toISOString();
    const webhook: InboundWebhook = {
      id,
      tenantId,
      name,
      enabled: true,
      connectionId,
      secretEnvelope: this.deps.cipher.encrypt(this.deps.newSecret(), webhookSecretContext(tenantId, id)),
      mapping: EMPTY_WEBHOOK_MAPPING,
      sample: null,
      sampleReceivedAt: null,
      createdAt: at,
      updatedAt: at
    };
    await this.deps.repository.create(webhook);
    return this.detail(webhook, undefined);
  }

  public async update(tenantId: string, id: string, request: UpdateWebhookRequest): Promise<WebhookDetail> {
    const current = await this.require(tenantId, id);
    const connectionId = request.connectionId !== undefined ? await this.requireConnection(tenantId, request.connectionId) : current.connectionId;
    const mapping = request.mapping !== undefined ? requireWebhookMapping(readWebhookMapping(request.mapping)) : current.mapping;
    if (mapping.flowId && !connectionId) throw new ValidationError("Para iniciar un flujo, elige el número de WhatsApp por el que sale.");
    const next: InboundWebhook = {
      ...current,
      ...(request.name !== undefined ? { name: requireWebhookName(request.name) } : {}),
      ...(typeof request.enabled === "boolean" ? { enabled: request.enabled } : {}),
      connectionId,
      mapping,
      updatedAt: this.now().toISOString()
    };
    await this.deps.repository.update(next);
    return this.get(tenantId, id);
  }

  public async remove(tenantId: string, id: string): Promise<void> {
    if (!(await this.deps.repository.remove(tenantId, id))) throw new NotFoundError("Ese webhook no existe.");
  }

  public async history(tenantId: string, id: string): Promise<WebhookDelivery[]> {
    await this.require(tenantId, id);
    return this.deps.repository.deliveries(tenantId, id, HISTORY_LIMIT);
  }

  private async require(tenantId: string, id: string): Promise<InboundWebhook> {
    const webhook = await this.deps.repository.findById(tenantId, id);
    if (!webhook) throw new NotFoundError("Ese webhook no existe.");
    return webhook;
  }

  private async requireConnection(tenantId: string, connectionId: string | null): Promise<string | null> {
    if (!connectionId) return null;
    if (!(await this.deps.connections.find(tenantId, connectionId))) throw new ValidationError("Ese número de WhatsApp no existe en tu cuenta.");
    return connectionId;
  }

  private summary(webhook: InboundWebhook, usage: { readonly count: number; readonly lastReceivedAt: string | null } | undefined): WebhookSummary {
    return {
      id: webhook.id,
      name: webhook.name,
      enabled: webhook.enabled,
      connectionId: webhook.connectionId,
      receivedThisMonth: usage?.count ?? 0,
      lastReceivedAt: usage?.lastReceivedAt ?? null,
      createdAt: webhook.createdAt
    };
  }

  private detail(webhook: InboundWebhook, usage: { readonly count: number; readonly lastReceivedAt: string | null } | undefined): WebhookDetail {
    const secret = this.deps.cipher.decrypt(webhook.secretEnvelope, webhookSecretContext(webhook.tenantId, webhook.id));
    return {
      ...this.summary(webhook, usage),
      url: `${this.deps.publicBaseUrl}${INBOUND_WEBHOOK_PATH}/${webhook.id}/${secret}`,
      mapping: webhook.mapping,
      sample: webhook.sample,
      sampleReceivedAt: webhook.sampleReceivedAt
    };
  }
}
