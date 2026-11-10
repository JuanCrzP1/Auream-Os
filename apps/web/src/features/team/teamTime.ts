// Tiempos del equipo en palabras: «En línea», «Hace 2 horas», «hoy 10:30».

const MINUTE = 60_000;
const TIME = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
export const MONTH_YEAR = new Intl.DateTimeFormat("es", { month: "short", year: "numeric" });

/** La última vez que alguien usó la app. «En línea» si fue hace menos de 3 minutos. */
export function lastSeenLabel(lastSeenAt: string | null, now = Date.now()): { readonly text: string; readonly online: boolean } {
  if (!lastSeenAt) return { text: "Aún no ha entrado", online: false };
  const minutes = Math.max(0, Math.floor((now - new Date(lastSeenAt).getTime()) / MINUTE));
  if (minutes < 3) return { text: "En línea", online: true };
  if (minutes < 60) return { text: `Hace ${minutes} min`, online: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { text: hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`, online: false };
  const days = Math.floor(hours / 24);
  return { text: days === 1 ? "Ayer" : `Hace ${days} días`, online: false };
}

/** Cuándo pasó algo de la actividad: «hoy 10:30», «ayer 9:12», «8 nov.». */
export function activityTime(at: string, now = new Date()): string {
  const date = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return `hoy ${TIME.format(date)}`;
  if (date.getTime() >= startOfToday - 24 * 60 * MINUTE) return `ayer ${TIME.format(date)}`;
  return DAY.format(date);
}
