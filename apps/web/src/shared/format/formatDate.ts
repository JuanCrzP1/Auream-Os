// Fechas como se leen en la interfaz (español). Compartido por los módulos.

const DATE_TIME = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

const valid = (iso: string): Date | null => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** «8 nov 2026, 16:05». */
export function formatDateTime(iso: string): string {
  const date = valid(iso);
  return date ? DATE_TIME.format(date) : "";
}

/** «8 nov 2026». */
export function formatDate(iso: string): string {
  const date = valid(iso);
  return date ? DATE.format(date) : "";
}
