import { timingSafeEqual } from "node:crypto";
import type { WebhookDeliveryOutcome } from "../../../contracts/WebhookContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { normalizePhone, readText, webhookSecretContext, type InboundWebhook } from "../domain/InboundWebhook";
import type { WebhookConnections, WebhookContacts, WebhookFlows, WebhookRepository } from "./ports";

// ---------------------------------------------------------------------------
// Recibir un envío en un webhook de entrada, en dos pasos:
//
//   authenticate   ¿la dirección es de un webhook y su secreto coincide?
//                  (la ruta responde enseguida: 404 si no, 202 si sí)
//   process        en segundo plano: lo guarda como ejemplo y, con el mapeo,
//                  identifica al cliente por su teléfono, guarda nombre,
//                  correo y campos, pone y quita etiquetas e inicia el flujo
//                  (si el webhook tiene número y está conectado)
//
// Todo queda en el historial con lo que se hizo y lo que se omitió. A
// diferencia de Leona, las etiquetas y los datos NO necesitan número: solo
// iniciar el flujo.
// ---------------------------------------------------------------------------

export interface ReceiveWebhookDependencies {
  readonly repository: WebhookRepository;
  readonly cipher: SecretCipher;
  readonly contacts: WebhookContacts;
  readonly connections: WebhookConnections;
  readonly flows: WebhookFlows;
  readonly now?: () => Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class ReceiveWebhookService {
  private readonly now: () => Date;

  public constructor(private readonly deps: ReceiveWebhookDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  public async authenticate(id: string, secret: string): Promise<InboundWebhook | null> {
    const webhook = await this.deps.repository.findForDelivery(id);
    if (!webhook || !secret) return null;
    try {
      return sameSecret(this.deps.cipher.decrypt(webhook.secretEnvelope, webhookSecretContext(webhook.tenantId, webhook.id)), secret) ? webhook : null;
    } catch {
      return null;
    }
  }

  public async process(webhook: InboundWebhook, payload: unknown): Promise<WebhookDeliveryOutcome> {
    const receivedAt = this.now().toISOString();
    const notes: string[] = [];
    let phone: string | null = null;
    let contactId: string | null = null;
    let flowStarted = false;
    const record = async (outcome: WebhookDeliveryOutcome, error: string | null = null) => {
      await this.deps.repository.recordDelivery({ tenantId: webhook.tenantId, webhookId: webhook.id, receivedAt, outcome, phone, contactId, flowStarted, notes, error, payload });
      return outcome;
    };

    await this.deps.repository.saveSample(webhook.tenantId, webhook.id, payload, receivedAt);
    if (!webhook.enabled) return record("ignored", "El webhook está desactivado.");
    const mapping = webhook.mapping;
    if (!mapping.phonePath) {
      notes.push("Guardado como ejemplo: falta elegir de dónde sale el teléfono.");
      return record("sample");
    }
    phone = normalizePhone(readText(payload, mapping.phonePath), mapping.defaultCountryCode);
    if (!phone) return record("failed", `No llegó un teléfono válido en «${mapping.phonePath}».`);

    try {
      contactId = (await this.deps.contacts.identify(webhook.tenantId, phone, mapping.namePath ? readText(payload, mapping.namePath) : null)).contactId;
      await this.saveData(webhook, contactId, payload, notes);
      if (mapping.addTags.length > 0) {
        await this.deps.contacts.addTags(webhook.tenantId, contactId, mapping.addTags);
        notes.push(`Etiquetas puestas: ${mapping.addTags.join(", ")}.`);
      }
      if (mapping.removeTags.length > 0) {
        await this.deps.contacts.removeTags(webhook.tenantId, contactId, mapping.removeTags);
        notes.push(`Etiquetas quitadas: ${mapping.removeTags.join(", ")}.`);
      }
    } catch (error) {
      return record("failed", `No se pudo guardar el contacto: ${messageOf(error)}`);
    }

    if (!mapping.flowId) return record("processed");
    const flowError = await this.startFlow(webhook, phone, contactId, notes);
    flowStarted = flowError === null;
    return record("processed", flowError);
  }

  private async saveData(webhook: InboundWebhook, contactId: string, payload: unknown, notes: string[]): Promise<void> {
    const fields: Record<string, string> = {};
    for (const field of webhook.mapping.fields) {
      const value = readText(payload, field.path);
      if (value === null) notes.push(`Sin dato para «${field.key}» en «${field.path}».`);
      else fields[field.key] = value;
    }
    const email = webhook.mapping.emailPath ? readText(payload, webhook.mapping.emailPath) : null;
    if (email && !EMAIL.test(email)) notes.push(`El correo «${email}» no es válido: no se guardó.`);
    const validEmail = email && EMAIL.test(email) ? email.toLowerCase() : null;
    if (Object.keys(fields).length > 0 || validEmail) {
      await this.deps.contacts.update(webhook.tenantId, contactId, { fields, ...(validEmail ? { email: validEmail } : {}) });
    }
  }

  /** `null` si inició el flujo; si no, por qué (también queda en las notas). */
  private async startFlow(webhook: InboundWebhook, phone: string, contactId: string, notes: string[]): Promise<string | null> {
    const skip = (reason: string) => {
      notes.push(`No se inició el flujo: ${reason}`);
      return `No se inició el flujo: ${reason}`;
    };
    if (!webhook.connectionId) return skip("el webhook no tiene número de WhatsApp.");
    const connection = await this.deps.connections.find(webhook.tenantId, webhook.connectionId);
    if (!connection) return skip("su número de WhatsApp ya no existe.");
    if (!connection.connected) return skip(`el número «${connection.name}» está desconectado.`);
    try {
      const { flowName } = await this.deps.flows.launch(webhook.tenantId, { connectionId: webhook.connectionId, phone, contactId }, webhook.mapping.flowId);
      notes.push(`Flujo iniciado: «${flowName}».`);
      return null;
    } catch (error) {
      return skip(messageOf(error));
    }
  }
}

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
