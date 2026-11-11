import type { NumberPace } from "../../../contracts/BroadcastResultsContracts";
import { capToday, localTime, warmupDay } from "../domain/Pace";
import type { BroadcastEngine } from "./BroadcastEngine";

/**
 * Cómo va cada número hoy: cuánto envió (todas las difusiones), su tope con el
 * calentamiento y si sigue conectado.
 */
export async function numberPaces(
  engine: Pick<BroadcastEngine, "numbers" | "recipients" | "now">,
  tenantId: string,
  connectionIds: ReadonlyArray<string>,
  dailyCap: number,
  timezone: string
): Promise<NumberPace[]> {
  const numbers = await engine.numbers.list(tenantId);
  const dayStart = localTime(engine.now(), timezone).dayStart;
  return Promise.all(
    connectionIds.map(async (connectionId) => {
      const number = numbers.find((item) => item.id === connectionId);
      const [sentToday, days] = await Promise.all([engine.recipients.sentSince(tenantId, connectionId, dayStart), engine.recipients.daysWithSends(tenantId, connectionId, timezone)]);
      const sentBefore = sentToday > 0 ? Math.max(0, days - 1) : days;
      return {
        connectionId,
        name: number?.name ?? "Número eliminado",
        sentToday,
        capToday: capToday(dailyCap, days, sentToday > 0),
        warmupDay: warmupDay(sentBefore),
        connected: number?.connected ?? false
      };
    })
  );
}
