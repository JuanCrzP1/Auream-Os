import type { GroupPostContent, GroupPostStatus, GroupState } from "@contracts/GroupContracts";
import type { MoneyAmount } from "@contracts/BroadcastResultsContracts";
import { formatMoney } from "@shared/format/formatMoney";

// Las palabras de Grupos: estados, porcentajes, plata y fechas.

const NUMBER = new Intl.NumberFormat("es-CO");
export const count = (value: number) => NUMBER.format(value);

export function percent(part: number, total: number): string {
  if (total <= 0) return "—";
  const value = (part / total) * 100;
  return `${value > 0 && value < 1 ? value.toFixed(1).replace(".", ",") : Math.round(value)} %`;
}

export function money(revenue: ReadonlyArray<MoneyAmount>): { readonly main: string; readonly others: number } {
  const [first, ...rest] = revenue;
  return { main: first ? formatMoney(first.amount, first.currency) : "$ 0", others: rest.length };
}

export const GROUP_STATE: Readonly<Record<GroupState, { readonly label: string; readonly tone: string }>> = {
  open: { label: "Recibiendo", tone: "live" },
  full: { label: "Lleno", tone: "done" },
  standby: { label: "En espera", tone: "muted" },
  other: { label: "Sin campaña", tone: "muted" }
};

export const POST_STATUS: Readonly<Record<GroupPostStatus, string>> = { scheduled: "Programado", sending: "Enviando", done: "Enviado", cancelled: "Cancelado" };

const WHEN = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const when = (iso: string | null) => (iso ? WHEN.format(new Date(iso)) : "");

export function postLabel(content: GroupPostContent): string {
  const icon = { text: "💬", image: "📷", video: "🎬", audio: "🎙", poll: "📊" }[content.kind];
  const body = content.text || content.fileName || { image: "Foto", video: "Video", audio: "Nota de voz", text: "", poll: "" }[content.kind];
  return `${icon} ${body.length > 90 ? `${body.slice(0, 90)}…` : body}`;
}
