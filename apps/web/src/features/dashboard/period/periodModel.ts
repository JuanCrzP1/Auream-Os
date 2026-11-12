// ---------------------------------------------------------------------------
// El periodo del Dashboard: un atajo (Hoy, 7 días, Mes pasado…) que se mueve
// con el calendario, o unas fechas elegidas a mano. Vive en la dirección
// (`period=lastMonth` o `from=2026-10-01&to=2026-10-31`) para compartirlo y
// volver a él. Días del navegador; el servidor corta en la hora de la empresa
// y compara con el periodo anterior del mismo largo (`DashboardPeriod`).
// Puro: sin React.
// ---------------------------------------------------------------------------

export type PresetId = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "90d" | "year";

export interface DashboardPeriod {
  /** El atajo elegido; `null` = fechas a mano. */
  readonly preset: PresetId | null;
  readonly from: string;
  readonly to: string;
}

/** Las cápsulas de siempre; los demás atajos van en «Fechas». */
export const QUICK_PRESETS: ReadonlyArray<PresetId> = ["today", "7d", "30d", "month"];
export const ALL_PRESETS: ReadonlyArray<PresetId> = ["today", "yesterday", "7d", "30d", "90d", "month", "lastMonth", "year"];
export const DEFAULT_PRESET: PresetId = "30d";
/** Lo mismo que acepta la API. */
export const MAX_DAYS = 366;

export const PRESET_LABEL: Readonly<Record<PresetId, string>> = {
  today: "Hoy", yesterday: "Ayer", "7d": "7 días", "30d": "30 días", month: "Este mes", lastMonth: "Mes pasado", "90d": "90 días", year: "Este año"
};
const PRESET_MENU_LABEL: Readonly<Record<PresetId, string>> = { ...PRESET_LABEL, "7d": "Últimos 7 días", "30d": "Últimos 30 días", "90d": "Últimos 90 días" };
export const presetMenuLabel = (id: PresetId) => PRESET_MENU_LABEL[id];

const PRESET_WORDS: Readonly<Record<PresetId, string>> = {
  today: "hoy", yesterday: "ayer", "7d": "últimos 7 días", "30d": "últimos 30 días", month: "este mes", lastMonth: "el mes pasado", "90d": "últimos 90 días", year: "este año"
};

// --- Días como texto `YYYY-MM-DD` (se comparan como texto) ---

export const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const dateOf = (day: string) => new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
export const addDays = (day: string, days: number) => {
  const date = dateOf(day);
  return isoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
};
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000) + 1;
const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isoDay(dateOf(value)) === value;

/** Fechas de un atajo, contando desde hoy. */
export function presetRange(preset: PresetId, now = new Date()): { from: string; to: string } {
  const today = isoDay(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "month": return { from: isoDay(new Date(y, m, 1)), to: today };
    case "lastMonth": return { from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) };
    case "year": return { from: isoDay(new Date(y, 0, 1)), to: today };
    default: return { from: addDays(today, -((preset === "7d" ? 7 : preset === "30d" ? 30 : 90) - 1)), to: today };
  }
}

/** Por qué unas fechas no sirven (o `null` si sirven). */
export function rangeProblem(from: string, to: string, now = new Date()): string | null {
  if (from > to) return "La fecha de inicio va antes que la final.";
  if (to > isoDay(now)) return "Elige días que ya pasaron.";
  if (daysBetween(from, to) > MAX_DAYS) return "Elige un periodo de hasta un año.";
  return null;
}

const isPreset = (value: string | null): value is PresetId => ALL_PRESETS.includes(value as PresetId);

/** El periodo de la dirección; si no hay o no sirve, los últimos 30 días. */
export function readPeriod(params: URLSearchParams, now = new Date()): DashboardPeriod {
  const preset = params.get("period");
  if (isPreset(preset)) return { preset, ...presetRange(preset, now) };
  const from = params.get("from");
  const to = params.get("to");
  if (isDay(from) && isDay(to) && !rangeProblem(from, to, now)) return { preset: null, from, to };
  return { preset: DEFAULT_PRESET, ...presetRange(DEFAULT_PRESET, now) };
}

/** Los cambios de la dirección para guardar un periodo (`null` borra). */
export function periodParams(period: DashboardPeriod): Record<string, string | null> {
  if (period.preset) return { period: period.preset === DEFAULT_PRESET ? null : period.preset, from: null, to: null };
  return { period: null, from: period.from, to: period.to };
}

/** Si las fechas son las de un atajo, el periodo queda como ese atajo (sigue moviéndose con los días). */
export function choosePeriod(from: string, to: string, now = new Date()): DashboardPeriod {
  const preset = ALL_PRESETS.find((id) => {
    const range = presetRange(id, now);
    return range.from === from && range.to === to;
  });
  return { preset: preset ?? null, from, to };
}

/** El periodo anterior del mismo largo (con el que se comparan los cambios). */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const before = addDays(from, -1);
  return { from: addDays(before, -(daysBetween(from, to) - 1)), to: before };
}

// Fijos (Intl dice «sept» en unos navegadores y «sep» en otros).
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
const monthOf = (day: string) => MONTHS[+day.slice(5, 7) - 1]!;
/** «7 oct» o «7 oct 2025». */
export const dayLabel = (day: string, withYear = false) => `${+day.slice(8, 10)} ${monthOf(day)}${withYear ? ` ${day.slice(0, 4)}` : ""}`;

/** «3 – 18 oct», «28 sep – 4 oct», «15 dic 2025 – 10 ene 2026», «7 oct». */
export function rangeLabel(from: string, to: string, now = new Date()): string {
  const year = String(now.getFullYear());
  const withYear = from.slice(0, 4) !== to.slice(0, 4) || from.slice(0, 4) !== year;
  const day = (value: string, month: boolean, showYear: boolean) =>
    `${+value.slice(8, 10)}${month ? ` ${monthOf(value)}` : ""}${showYear ? ` ${value.slice(0, 4)}` : ""}`;
  if (from === to) return day(from, true, withYear);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const splitYear = from.slice(0, 4) !== to.slice(0, 4);
  return `${day(from, !sameMonth, splitYear)} – ${day(to, true, withYear)}`;
}

/** Cómo se nombra el periodo dentro de una frase: «últimos 7 días», «del 3 al 18 oct», «el 7 oct». */
export function periodWords(period: DashboardPeriod, now = new Date()): string {
  if (period.preset) return PRESET_WORDS[period.preset];
  if (period.from === period.to) return `el ${rangeLabel(period.from, period.to, now)}`;
  const [start, end] = rangeLabel(period.from, period.to, now).split(" – ");
  return `del ${start} al ${end}`;
}

/** El nombre corto del periodo (el botón «Fechas»). */
export const periodLabel = (period: DashboardPeriod, now = new Date()) => (period.preset ? PRESET_LABEL[period.preset] : rangeLabel(period.from, period.to, now));
