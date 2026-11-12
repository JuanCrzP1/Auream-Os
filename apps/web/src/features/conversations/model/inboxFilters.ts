import type { ConversationFilter, ConversationListQuery, ConversationStatus } from "@contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// Filtros de la bandeja: la pestaña (en espera, en atención, con bot,
// resueltos), los filtros rápidos (mis chats, no leídos, sin responder) y el
// panel (número, responsable, etiquetas y fecha del último mensaje). Las fechas se calculan en la zona horaria de
// quien mira: «hoy» es su hoy, no el del servidor.
// ---------------------------------------------------------------------------

export type DatePreset = "any" | "today" | "yesterday" | "last7" | "last30" | "custom";

export interface DateChoice {
  readonly preset: DatePreset;
  /** Solo con `custom`: días `AAAA-MM-DD` (ambos incluidos). */
  readonly from?: string;
  readonly to?: string;
}

export type InboxTab = ConversationStatus | "all";

export interface InboxFilters {
  readonly tab: InboxTab;
  readonly status: ConversationFilter;
  /** Responsable: "" cualquiera, "none" sin asignar, o el id del asesor. */
  readonly assigneeId: string;
  readonly search: string;
  readonly connectionId: string;
  readonly labelIds: ReadonlyArray<string>;
  readonly date: DateChoice;
}

export const EMPTY_FILTERS: InboxFilters = { tab: "all", status: "all", assigneeId: "", search: "", connectionId: "", labelIds: [], date: { preset: "any" } };

/** Las pestañas, en el orden en que se atienden: lo que espera primero. */
export const TAB_OPTIONS: ReadonlyArray<{ readonly value: InboxTab; readonly label: string }> = [
  { value: "all", label: "Todos" },
  { value: "waiting", label: "En espera" },
  { value: "attending", label: "En atención" },
  { value: "bot", label: "Con bot" },
  { value: "resolved", label: "Resueltos" }
];

/** Filtros rápidos (uno a la vez). */
export const STATUS_OPTIONS: ReadonlyArray<{ readonly value: ConversationFilter; readonly label: string }> = [
  { value: "all", label: "Todos" },
  { value: "mine", label: "Mis chats" },
  { value: "unread", label: "No leídos" },
  { value: "unanswered", label: "Sin responder" }
];

export const DATE_OPTIONS: ReadonlyArray<{ readonly value: DatePreset; readonly label: string }> = [
  { value: "any", label: "Cualquier fecha" },
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "last7", label: "Últimos 7 días" },
  { value: "last30", label: "Últimos 30 días" },
  { value: "custom", label: "Elegir fechas" }
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** `AAAA-MM-DD` → medianoche local de ese día. */
function localDay(value: string | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Desde (incluido) / hasta (excluido) del último mensaje, en ISO. */
export function dateBounds(choice: DateChoice, now: Date = new Date()): { readonly from?: string; readonly to?: string } {
  const today = startOfDay(now);
  switch (choice.preset) {
    case "today":
      return { from: today.toISOString() };
    case "yesterday":
      return { from: addDays(today, -1).toISOString(), to: today.toISOString() };
    case "last7":
      return { from: addDays(today, -6).toISOString() };
    case "last30":
      return { from: addDays(today, -29).toISOString() };
    case "custom": {
      const from = localDay(choice.from);
      const to = localDay(choice.to);
      return { ...(from ? { from: from.toISOString() } : {}), ...(to ? { to: addDays(to, 1).toISOString() } : {}) };
    }
    default:
      return {};
  }
}

/** Un rango elegido a mano con «desde» después de «hasta». */
export function invalidCustomRange(choice: DateChoice): boolean {
  if (choice.preset !== "custom") return false;
  const from = localDay(choice.from);
  const to = localDay(choice.to);
  return Boolean(from && to && from > to);
}

/** Lo que se le pide a la API (sin la página). */
export function toListQuery(filters: InboxFilters, now: Date = new Date()): ConversationListQuery {
  const search = filters.search.trim();
  const dates = invalidCustomRange(filters.date) ? {} : dateBounds(filters.date, now);
  return {
    filter: filters.status,
    ...(filters.tab !== "all" ? { status: filters.tab } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(search ? { search } : {}),
    ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
    ...(filters.labelIds.length ? { labelIds: filters.labelIds } : {}),
    ...dates
  };
}

/** Cuántos filtros del panel hay puestos (número, responsable, etiquetas, fecha). */
export function panelFilterCount(filters: InboxFilters): number {
  return (filters.connectionId ? 1 : 0) + (filters.assigneeId ? 1 : 0) + filters.labelIds.length + (filters.date.preset === "any" ? 0 : 1);
}

/** Algún filtro además de la pestaña (para «Limpiar filtros»). */
export function isFiltered(filters: InboxFilters): boolean {
  return filters.status !== "all" || filters.search.trim() !== "" || panelFilterCount(filters) > 0;
}

/** Texto corto de la fecha elegida («Hoy», «3 nov – 9 nov»…). */
export function dateLabel(choice: DateChoice): string {
  if (choice.preset !== "custom") return DATE_OPTIONS.find((option) => option.value === choice.preset)?.label ?? "";
  const format = (value: string | undefined) => {
    const day = localDay(value);
    return day ? day.toLocaleDateString("es", { day: "numeric", month: "short" }) : "…";
  };
  return `${format(choice.from)} – ${format(choice.to)}`;
}
