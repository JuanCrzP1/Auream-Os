import type { BroadcastStats, BroadcastSummary } from "../../../contracts/BroadcastResultsContracts";
import type { Broadcast } from "../domain/Broadcast";

// De la difusión guardada a lo que ve la pantalla, con los nombres de los
// números y los flujos (si se borró uno, queda su id para no romper nada).

export const EMPTY_STATS: BroadcastStats = { total: 0, pending: 0, sent: 0, failed: 0, skipped: 0, delivered: 0, read: 0, replied: 0, optedOut: 0, bought: 0, revenue: [] };

export interface ViewNames {
  readonly numbers: ReadonlyMap<string, string>;
  readonly flows: ReadonlyMap<string, { readonly name: string }>;
  readonly broadcasts: ReadonlyMap<string, string>;
}

export function toSummary(broadcast: Broadcast, stats: BroadcastStats | undefined, names: ViewNames): BroadcastSummary {
  const flowName = (content: Broadcast["variants"][number]) => (content.kind === "flow" ? names.flows.get(content.automationId)?.name ?? "Flujo borrado" : null);
  return {
    id: broadcast.id,
    name: broadcast.name,
    status: broadcast.status,
    statusReason: broadcast.statusReason,
    parentId: broadcast.parentId,
    parentName: broadcast.parentId ? names.broadcasts.get(broadcast.parentId) ?? null : null,
    variants: broadcast.variants.map((content) => ({ content, flowName: flowName(content) })),
    audience: broadcast.audience,
    connections: broadcast.connectionIds.map((id) => ({ id, name: names.numbers.get(id) ?? "Número eliminado" })),
    settings: broadcast.settings,
    abTest: broadcast.abTest ? { ...broadcast.abTest, winner: broadcast.winner, decidesAt: broadcast.decidesAt } : null,
    followUp: broadcast.followUp ? { ...broadcast.followUp, dueAt: broadcast.followUpDueAt, childId: broadcast.followUpChildId } : null,
    scheduledAt: broadcast.scheduledAt,
    startedAt: broadcast.startedAt,
    finishedAt: broadcast.finishedAt,
    createdAt: broadcast.createdAt,
    stats: stats ?? EMPTY_STATS
  };
}

/** Los flujos que usa una difusión (sus versiones y el segundo envío). */
export function flowIdsOf(broadcasts: ReadonlyArray<Pick<Broadcast, "variants" | "followUp">>): string[] {
  const ids = broadcasts.flatMap((broadcast) => [...broadcast.variants, ...(broadcast.followUp ? [broadcast.followUp.content] : [])]);
  return [...new Set(ids.flatMap((content) => (content.kind === "flow" ? [content.automationId] : [])))];
}
