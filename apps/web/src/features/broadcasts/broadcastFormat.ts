import type { BroadcastContent } from "@contracts/BroadcastContracts";
import type { BroadcastStats, BroadcastStatus, BroadcastSummary, MoneyAmount, RecipientState } from "@contracts/BroadcastResultsContracts";
import { formatMoney } from "@shared/format/formatMoney";

// Las palabras de Difusiones: estados, porcentajes, plata y fechas.

export type Tone = "live" | "soon" | "done" | "paused" | "muted";

export const STATUS: Readonly<Record<BroadcastStatus, { readonly label: string; readonly tone: Tone }>> = {
  scheduled: { label: "Programada", tone: "soon" },
  sending: { label: "Enviando", tone: "live" },
  testing: { label: "Probando versiones", tone: "live" },
  paused: { label: "Pausada", tone: "paused" },
  auto_paused: { label: "Pausada sola", tone: "paused" },
  done: { label: "Terminada", tone: "done" },
  cancelled: { label: "Cancelada", tone: "muted" }
};

export const RECIPIENT_STATE: Readonly<Record<RecipientState, { readonly label: string; readonly tone: string }>> = {
  pending: { label: "En cola", tone: "muted" },
  sent: { label: "Enviado", tone: "muted" },
  delivered: { label: "Entregado", tone: "muted" },
  read: { label: "Leyó", tone: "read" },
  replied: { label: "Respondió", tone: "live" },
  bought: { label: "Compró", tone: "done" },
  failed: { label: "Falló", tone: "paused" },
  opted_out: { label: "No quiere más", tone: "soon" },
  skipped: { label: "No se envió", tone: "muted" }
};

const NUMBER = new Intl.NumberFormat("es-CO");
export const count = (value: number) => NUMBER.format(value);

/** «61 %» de una parte sobre el total; «—» si no hay de dónde. */
export function percent(part: number, total: number): string {
  if (total <= 0) return "—";
  const value = (part / total) * 100;
  return `${value > 0 && value < 1 ? value.toFixed(1).replace(".", ",") : Math.round(value)} %`;
}

/** La plata principal y cuántas monedas más hay. */
export function money(revenue: ReadonlyArray<MoneyAmount>): { readonly main: string; readonly others: number } {
  const [first, ...rest] = revenue;
  return { main: first ? formatMoney(first.amount, first.currency) : "$ 0", others: rest.length };
}

/** Avance del envío (0–100). */
export function progress(stats: BroadcastStats): number {
  const done = stats.total - stats.pending;
  return stats.total > 0 ? Math.round((done / stats.total) * 100) : 0;
}

const WHEN = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const when = (iso: string | null) => (iso ? WHEN.format(new Date(iso)) : "");

/** «Flujo «Oferta mamá»» o «Mensaje con foto». */
export function contentLabel(content: BroadcastContent, flowName: string | null): string {
  if (content.kind === "flow") return `Flujo «${flowName ?? "sin nombre"}»`;
  if (content.media) return content.media.type === "video" ? "Mensaje con video" : "Mensaje con foto";
  return "Mensaje de texto";
}

/** Una línea sobre qué envía la difusión. */
export function whatItSends(broadcast: Pick<BroadcastSummary, "variants">): string {
  const first = broadcast.variants[0];
  if (!first) return "";
  const label = contentLabel(first.content, first.flowName);
  return broadcast.variants.length > 1 ? `${label} · ${broadcast.variants.length} versiones` : label;
}

/** Cuándo pasó (o pasa) lo importante de la difusión. */
export function timeline(broadcast: BroadcastSummary): string {
  if (broadcast.status === "scheduled") return `sale ${when(broadcast.scheduledAt ?? broadcast.createdAt)}`;
  if (broadcast.status === "testing") return `decide ${when(broadcast.abTest?.decidesAt ?? null)}`;
  if (broadcast.finishedAt) return `terminó ${when(broadcast.finishedAt)}`;
  return broadcast.startedAt ? `empezó ${when(broadcast.startedAt)}` : "";
}

export const VARIANT_LETTERS = ["A", "B", "C"] as const;

/** El texto de una versión para leerlo en pantalla: las variables con palabras. */
export const readable = (text: string) => text.replace(/\{(first_name|nombre)(\|[^}]*)?\}/g, "[nombre]").replace(/\{full_name(\|[^}]*)?\}/g, "[nombre completo]");
