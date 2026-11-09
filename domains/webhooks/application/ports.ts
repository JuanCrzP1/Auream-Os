import type { WebhookDelivery, WebhookDeliveryOutcome } from "../../../contracts/WebhookContracts";
import type { InboundWebhook } from "../domain/InboundWebhook";

// ---------------------------------------------------------------------------
// Puertos de los webhooks de entrada. El dominio no conoce Contactos,
// Conexiones ni la mensajería: la composición los conecta con adaptadores.
// ---------------------------------------------------------------------------

export interface NewDelivery {
  readonly tenantId: string;
  readonly webhookId: string;
  readonly receivedAt: string;
  readonly outcome: WebhookDeliveryOutcome;
  readonly phone: string | null;
  readonly contactId: string | null;
  readonly flowStarted: boolean;
  readonly notes: ReadonlyArray<string>;
  readonly error: string | null;
  readonly payload: unknown;
}

export interface WebhookRepository {
  list(tenantId: string): Promise<InboundWebhook[]>;
  findById(tenantId: string, id: string): Promise<InboundWebhook | null>;
  /** Para recibir: por id, sin saber la cuenta (la dirección no la lleva). */
  findForDelivery(id: string): Promise<InboundWebhook | null>;
  create(webhook: InboundWebhook): Promise<void>;
  update(webhook: InboundWebhook): Promise<void>;
  remove(tenantId: string, id: string): Promise<boolean>;
  /** Guarda el último envío como ejemplo para mapear. */
  saveSample(tenantId: string, id: string, sample: unknown, receivedAt: string): Promise<void>;
  recordDelivery(delivery: NewDelivery): Promise<void>;
  deliveries(tenantId: string, webhookId: string, limit: number): Promise<WebhookDelivery[]>;
  /** Cuántos recibió cada webhook de la cuenta desde `since`, y cuándo fue el último. */
  usage(tenantId: string, since: string): Promise<Map<string, { readonly count: number; readonly lastReceivedAt: string | null }>>;
}

/** Lo que el webhook hace con Contactos. */
export interface WebhookContacts {
  /** El contacto de ese teléfono (lo crea si no existe; el nombre llena uno vacío). */
  identify(tenantId: string, phone: string, name: string | null): Promise<{ readonly contactId: string }>;
  update(tenantId: string, contactId: string, change: { readonly email?: string; readonly fields: Readonly<Record<string, string>> }): Promise<void>;
  addTags(tenantId: string, contactId: string, names: ReadonlyArray<string>): Promise<void>;
  removeTags(tenantId: string, contactId: string, names: ReadonlyArray<string>): Promise<void>;
}

/** Los números de WhatsApp de la cuenta (para elegir y para iniciar flujos). */
export interface WebhookConnections {
  find(tenantId: string, id: string): Promise<{ readonly name: string; readonly connected: boolean } | null>;
}

/** Iniciar un flujo para un teléfono por un número (reemplaza el que estuviera en curso). */
export interface WebhookFlows {
  launch(tenantId: string, target: { readonly connectionId: string; readonly phone: string; readonly contactId: string }, flowId: string): Promise<{ readonly flowName: string }>;
}
