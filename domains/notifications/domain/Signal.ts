import type { AppNotification, NotificationKind } from "../../../contracts/NotificationContracts";
import { describeFlowFailure, type FlowFailure } from "./flowFailure";

// ---------------------------------------------------------------------------
// Una señal: algo en la cuenta que pide atención, tal como lo leen los
// módulos. Aquí se vuelve un aviso con su texto y la pantalla que lo resuelve.
// ---------------------------------------------------------------------------

export type Signal =
  | { readonly kind: "number_disconnected"; readonly id: string; readonly name: string; readonly at: Date }
  | { readonly kind: "broadcast_auto_paused"; readonly id: string; readonly name: string; readonly reason: string | null; readonly at: Date }
  | { readonly kind: "sales_review"; readonly count: number; readonly at: Date }
  | { readonly kind: "follow_ups_due"; readonly count: number; readonly overdue: number; readonly at: Date }
  | { readonly kind: "group_created"; readonly id: string; readonly campaignId: string; readonly campaign: string; readonly group: string; readonly at: Date }
  | { readonly kind: "flow_failures"; readonly flowKey: string; readonly flow: string; readonly count: number; readonly last: FlowFailure; readonly at: Date };

/** Cuántos avisos muestra la campana como máximo. */
export const FEED_LIMIT = 30;

/** Los grupos nuevos de una campaña se avisan durante esta ventana. */
export const RECENT_GROUP_DAYS = 7;

/** Las fallas de un flujo se avisan durante esta ventana (el historial de turnos guarda 14 días). */
export const FLOW_FAILURE_HOURS = 24;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

type Described = Pick<AppNotification, "id" | "title" | "detail" | "path">;

export function describe(signal: Signal): Described {
  switch (signal.kind) {
    case "number_disconnected":
      return { id: `number:${signal.id}`, title: `${signal.name} se desconectó`, detail: "No recibe ni envía mensajes. Vuelve a escanear el código QR.", path: "/connections" };
    case "broadcast_auto_paused":
      return { id: `broadcast:${signal.id}`, title: `«${signal.name}» se pausó sola`, detail: signal.reason ?? "Revisa el motivo y reanúdala cuando esté listo.", path: `/broadcasts?id=${signal.id}` };
    case "sales_review":
      return { id: "sales:review", title: `${plural(signal.count, "venta espera", "ventas esperan")} revisión`, detail: "Complétalas para que cuenten en tus ventas y en el ROAS.", path: "/sales?tab=review" };
    case "follow_ups_due":
      return {
        id: "crm:follow-ups",
        title: `${plural(signal.count, "seguimiento", "seguimientos")} para hoy`,
        detail: signal.overdue > 0 ? `${plural(signal.overdue, "ya está vencido", "ya están vencidos")}.` : "Clientes que esperan que les escribas hoy.",
        path: "/crm?tab=follow-ups"
      };
    case "group_created":
      return { id: `group:${signal.id}`, title: `Nuevo grupo: ${signal.group}`, detail: `«${signal.campaign}» llenó un grupo y abrió el siguiente.`, path: `/groups?campaign=${signal.campaignId}` };
    case "flow_failures":
      return {
        id: `flow:${signal.flowKey}`,
        title: `«${signal.flow}» falló ${plural(signal.count, "vez", "veces")} en 24 h`,
        detail: describeFlowFailure(signal.last),
        path: `/builder/${encodeURIComponent(signal.flowKey)}`
      };
  }
}

/** Los avisos, del más reciente al más antiguo, con «sin leer» según la última vez que se abrió la campana. */
export function buildFeed(signals: ReadonlyArray<Signal>, seenAt: Date | null): ReadonlyArray<AppNotification> {
  return [...signals]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, FEED_LIMIT)
    .map((signal) => ({ ...describe(signal), kind: signal.kind as NotificationKind, occurredAt: signal.at.toISOString(), unread: seenAt === null || signal.at > seenAt }));
}
