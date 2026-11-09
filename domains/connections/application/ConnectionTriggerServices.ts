import { randomUUID } from "node:crypto";
import {
  CONNECTION_TRIGGER_TYPES,
  KEYWORD_MATCHES,
  MAX_TRIGGERS_PER_CONNECTION,
  normalizeTriggerText,
  selectTrigger,
  type ConnectionTrigger,
  type ConnectionTriggerType,
  type InboundTriggerFacts,
  type KeywordMatch,
  type SaveConnectionTriggerRequest
} from "../../../contracts/ConnectionTriggerContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { normalizeKeywords, type ConnectionTriggerRecord } from "../domain/ConnectionTriggerRecord";
import type { ConnectionRepository } from "./ConnectionRepository";
import type { ConnectionTriggerRepository } from "./ConnectionTriggerRepository";
import type { FlowCatalog, FlowReference } from "./ports/FlowCatalog";

// ---------------------------------------------------------------------------
// Disparadores de una conexión: qué flujo arranca cuando un cliente escribe a
// ese número. Reglas:
//   · el flujo es de la cuenta y no está archivado
//   · «anuncio», «primer mensaje» y «cualquier mensaje»: uno de cada uno por número
//   · una palabra clave dispara un solo flujo por número
// ---------------------------------------------------------------------------

const GENERIC_LABEL: Readonly<Record<Exclude<ConnectionTriggerType, "keyword">, string>> = {
  ad_click: "Llega desde un anuncio",
  first_message: "Primer mensaje de un contacto nuevo",
  any_message: "Cualquier mensaje"
};

function toTrigger(record: ConnectionTriggerRecord, flows: ReadonlyMap<string, FlowReference>): ConnectionTrigger {
  return {
    id: record.id,
    connectionId: record.connectionId,
    type: record.type,
    keywords: record.keywords,
    match: record.match,
    automationId: record.automationId,
    automationName: flows.get(record.automationId)?.name ?? "Flujo eliminado",
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

async function flowMap(catalog: FlowCatalog, tenantId: string, records: ReadonlyArray<ConnectionTriggerRecord>): Promise<Map<string, FlowReference>> {
  const ids = [...new Set(records.map((record) => record.automationId))];
  return new Map((ids.length ? await catalog.findMany(tenantId, ids) : []).map((flow) => [flow.id, flow]));
}

/** Lee y valida lo que mandó el cliente. */
interface ValidTrigger {
  readonly type: ConnectionTriggerType;
  readonly keywords: ReadonlyArray<string>;
  readonly match: KeywordMatch;
  readonly automationId: string;
  readonly enabled: boolean;
}

function readTrigger(input: Partial<SaveConnectionTriggerRequest>): ValidTrigger {
  const type = input.type;
  if (!type || !CONNECTION_TRIGGER_TYPES.includes(type)) throw new ValidationError("Elige cuándo se dispara: palabra clave, anuncio, primer mensaje o cualquier mensaje.");
  if (typeof input.automationId !== "string" || !input.automationId.trim()) throw new ValidationError("Elige el flujo que se va a disparar.");
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") throw new ValidationError("«Activo» debe ser sí o no.");

  if (type !== "keyword") return { type, keywords: [], match: "contains", automationId: input.automationId.trim(), enabled: input.enabled ?? true };

  const keywords = normalizeKeywords(input.keywords ?? []);
  if (!keywords) throw new ValidationError("Escribe de 1 a 20 palabras clave, de hasta 60 caracteres cada una.");
  const match = input.match ?? "contains";
  if (!KEYWORD_MATCHES.includes(match)) throw new ValidationError("Elige cómo comparar: contiene, es exactamente o empieza por.");
  return { type, keywords, match, automationId: input.automationId.trim(), enabled: input.enabled ?? true };
}

export class ConnectionTriggerServices {
  public constructor(
    private readonly connections: ConnectionRepository,
    private readonly triggers: ConnectionTriggerRepository,
    private readonly flows: FlowCatalog,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async list(tenantId: string, connectionId: string): Promise<ConnectionTrigger[]> {
    await this.requireConnection(tenantId, connectionId);
    const records = await this.triggers.listByConnection(tenantId, connectionId);
    const flows = await flowMap(this.flows, tenantId, records);
    return records.map((record) => toTrigger(record, flows));
  }

  public async create(tenantId: string, connectionId: string, input: Partial<SaveConnectionTriggerRequest>): Promise<ConnectionTrigger> {
    await this.requireConnection(tenantId, connectionId);
    const valid = readTrigger(input);
    const flow = await this.requireFlow(tenantId, valid.automationId);
    const siblings = await this.triggers.listByConnection(tenantId, connectionId);
    if (siblings.length >= MAX_TRIGGERS_PER_CONNECTION) throw new ValidationError(`Un número admite hasta ${MAX_TRIGGERS_PER_CONNECTION} disparadores.`);
    this.assertNoClash(valid, siblings);

    const at = this.now().toISOString();
    const record: ConnectionTriggerRecord = { id: randomUUID(), tenantId, connectionId, ...valid, createdAt: at, updatedAt: at };
    await this.triggers.save(record);
    return toTrigger(record, new Map([[flow.id, flow]]));
  }

  public async update(tenantId: string, connectionId: string, id: string, input: Partial<SaveConnectionTriggerRequest>): Promise<ConnectionTrigger> {
    const current = await this.requireTrigger(tenantId, connectionId, id);
    const valid = readTrigger({ ...current, ...input, keywords: input.keywords ?? current.keywords });
    const flow = await this.requireFlow(tenantId, valid.automationId);
    const siblings = (await this.triggers.listByConnection(tenantId, connectionId)).filter((trigger) => trigger.id !== id);
    this.assertNoClash(valid, siblings);

    const record: ConnectionTriggerRecord = { ...current, ...valid, updatedAt: this.now().toISOString() };
    await this.triggers.save(record);
    return toTrigger(record, new Map([[flow.id, flow]]));
  }

  public async remove(tenantId: string, connectionId: string, id: string): Promise<void> {
    await this.requireTrigger(tenantId, connectionId, id);
    await this.triggers.delete(tenantId, id);
  }

  /**
   * El flujo que debe arrancar con un mensaje entrante a esta conexión, o
   * `null` (lo usará la entrada de mensajes, FASE D4). Ignora flujos archivados.
   */
  public async resolve(tenantId: string, connectionId: string, facts: InboundTriggerFacts): Promise<{ readonly triggerId: string; readonly automationId: string } | null> {
    const records = await this.triggers.listByConnection(tenantId, connectionId);
    const flows = await flowMap(this.flows, tenantId, records);
    const usable = records.filter((record) => flows.has(record.automationId) && !flows.get(record.automationId)!.archived);
    const chosen = selectTrigger(usable, facts);
    return chosen ? { triggerId: chosen.id, automationId: chosen.automationId } : null;
  }

  private assertNoClash(valid: ValidTrigger, siblings: ReadonlyArray<ConnectionTriggerRecord>): void {
    if (valid.type !== "keyword") {
      if (siblings.some((trigger) => trigger.type === valid.type)) {
        throw new ConflictError(`Este número ya tiene un disparador «${GENERIC_LABEL[valid.type]}». Edítalo en lugar de crear otro.`);
      }
      return;
    }
    const taken = new Map(siblings.filter((trigger) => trigger.type === "keyword").flatMap((trigger) => trigger.keywords.map((keyword) => [normalizeTriggerText(keyword), keyword] as const)));
    const repeated = valid.keywords.find((keyword) => taken.has(normalizeTriggerText(keyword)));
    if (repeated) throw new ConflictError(`La palabra «${repeated}» ya dispara otro flujo en este número.`);
  }

  private async requireConnection(tenantId: string, connectionId: string): Promise<void> {
    if (!(await this.connections.findById(tenantId, connectionId))) throw new NotFoundError("Conexión no encontrada.");
  }

  private async requireTrigger(tenantId: string, connectionId: string, id: string): Promise<ConnectionTriggerRecord> {
    const trigger = await this.triggers.findById(tenantId, id);
    if (!trigger || trigger.connectionId !== connectionId) throw new NotFoundError("Disparador no encontrado.");
    return trigger;
  }

  private async requireFlow(tenantId: string, automationId: string): Promise<FlowReference> {
    const [flow] = await this.flows.findMany(tenantId, [automationId]);
    if (!flow) throw new ValidationError("Ese flujo no existe en tu cuenta.");
    if (flow.archived) throw new ValidationError(`«${flow.name}» está archivado: restáuralo o elige otro flujo.`);
    return flow;
  }
}
