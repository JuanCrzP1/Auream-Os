import { BROADCAST_LIMITS } from "../../../contracts/BroadcastContracts";
import type { AudiencePreview, SavedAudience } from "../../../contracts/BroadcastResultsContracts";
import { countryOfPhone } from "../../../contracts/Countries";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { requireAudience } from "../domain/BroadcastDraft";
import { estimateDays } from "../domain/Pace";
import type { BroadcastEngine } from "./BroadcastEngine";
import type { SavedAudienceRepository } from "./BroadcastPorts";
import { numberPaces } from "./numberPaces";

// ---------------------------------------------------------------------------
// A quién le llega: el número en vivo mientras se eligen los filtros (con lo
// que tarda según el tope de cada número) y las audiencias guardadas para
// repetir sin volver a armar los filtros.
// ---------------------------------------------------------------------------

const MAX_SAVED = 50;
const SAMPLE = 5;

export class AudienceServices {
  public constructor(
    private readonly engine: Pick<BroadcastEngine, "audience" | "numbers" | "recipients" | "timezoneOf" | "now" | "newId">,
    private readonly saved: SavedAudienceRepository
  ) {}

  public async preview(tenantId: string, body: unknown): Promise<AudiencePreview> {
    const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const audience = requireAudience(input["audience"]);
    const connectionIds = Array.isArray(input["connectionIds"]) ? input["connectionIds"].filter((id): id is string => typeof id === "string") : [];
    const dailyCap = typeof input["dailyCap"] === "number" ? Math.max(BROADCAST_LIMITS.minDailyCap, Math.min(BROADCAST_LIMITS.maxDailyCap, input["dailyCap"])) : BROADCAST_LIMITS.defaultDailyCap;
    if (connectionIds.length === 0) return { count: 0, perConnection: [], optedOut: 0, overLimit: 0, sample: [], days: 0, numbers: [] };

    const { candidates, optedOut } = await this.engine.audience.resolve(tenantId, audience, connectionIds, BROADCAST_LIMITS.maxRecipients * 4);
    const matching = audience.countries.length ? candidates.filter((candidate) => audience.countries.includes(countryOfPhone(candidate.phone) ?? "")) : candidates;
    const kept = matching.slice(0, BROADCAST_LIMITS.maxRecipients);
    const perConnection = connectionIds.map((connectionId) => ({ connectionId, count: kept.filter((candidate) => candidate.connectionId === connectionId).length }));

    const timezone = await this.engine.timezoneOf(tenantId);
    const numbers = await numberPaces(this.engine, tenantId, connectionIds, dailyCap, timezone);
    const days = await Promise.all(
      perConnection.map(async (entry) => ({ count: entry.count, daysWithSends: await this.engine.recipients.daysWithSends(tenantId, entry.connectionId, timezone) }))
    );
    return {
      count: kept.length,
      perConnection,
      optedOut,
      overLimit: matching.length - kept.length,
      sample: kept.slice(0, SAMPLE).map((candidate) => ({ name: candidate.name, phone: candidate.phone })),
      days: estimateDays(days, dailyCap),
      numbers
    };
  }

  public list(tenantId: string): Promise<ReadonlyArray<SavedAudience>> {
    return this.saved.list(tenantId);
  }

  public async save(tenantId: string, body: unknown): Promise<SavedAudience> {
    const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const name = typeof input["name"] === "string" ? input["name"].trim().slice(0, 60) : "";
    if (!name) throw new ValidationError("Ponle un nombre a la audiencia.");
    const existing = await this.saved.list(tenantId);
    if (existing.length >= MAX_SAVED) throw new ValidationError(`Puedes guardar hasta ${MAX_SAVED} audiencias.`);
    if (existing.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new ValidationError(`Ya tienes una audiencia «${name}».`);
    const audience: SavedAudience = { id: this.engine.newId(), name, audience: requireAudience(input["audience"]), createdAt: this.engine.now().toISOString() };
    await this.saved.save(tenantId, audience);
    return audience;
  }

  public async remove(tenantId: string, id: string): Promise<void> {
    if (!(await this.saved.remove(tenantId, id))) throw new NotFoundError("Esa audiencia no existe.");
  }
}
