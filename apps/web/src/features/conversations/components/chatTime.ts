// Fechas como las muestra WhatsApp.

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const yesterday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
const TIME = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("es", { weekday: "long" });
const SHORT = new Intl.DateTimeFormat("es", { day: "numeric", month: "numeric", year: "2-digit" });
const LONG = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" });

/** Hora del mensaje: «10:35». */
export function messageTime(iso: string): string {
  return TIME.format(new Date(iso));
}

/** En la lista de chats: hoy la hora; ayer «Ayer»; esta semana el día; si no, la fecha. */
export function listTime(iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (sameDay(date, now)) return TIME.format(date);
  if (sameDay(date, yesterday(now))) return "Ayer";
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return WEEKDAY.format(date);
  return SHORT.format(date);
}

/** Separador entre días del hilo: «Hoy», «Ayer» o «8 de noviembre de 2026». */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (sameDay(date, now)) return "Hoy";
  if (sameDay(date, yesterday(now))) return "Ayer";
  return LONG.format(date);
}

export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
