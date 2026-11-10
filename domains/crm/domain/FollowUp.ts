import type { FollowUpBucket } from "../../../contracts/CrmActivityContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Seguimiento: algo que hay que hacer con un cliente, a una hora, y quién lo
// hace («Llamar mañana a las 3 p. m.»). Se agrupan en Vencidos · Hoy ·
// Próximos según el día de la empresa, no el del servidor.
// ---------------------------------------------------------------------------

export interface FollowUp {
  readonly id: string;
  readonly tenantId: string;
  readonly contactId: string;
  readonly title: string;
  readonly dueAt: string;
  readonly assigneeId: string | null;
  readonly createdBy: string | null;
  readonly doneAt: string | null;
  readonly doneBy: string | null;
}

export const FOLLOW_UP_TITLE_MAX = 140;
/** Un año hacia atrás o adelante: más allá es casi seguro un error de fecha. */
const MAX_RANGE_MS = 366 * 86_400_000;

export function requireFollowUpTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new ValidationError("Escribe qué hay que hacer.");
  if (title.length > FOLLOW_UP_TITLE_MAX) throw new ValidationError(`El seguimiento admite hasta ${FOLLOW_UP_TITLE_MAX} caracteres.`);
  return title;
}

export function requireDueAt(value: unknown, now: Date): Date {
  const due = typeof value === "string" ? new Date(value) : null;
  if (!due || Number.isNaN(due.getTime())) throw new ValidationError("Elige cuándo.");
  if (Math.abs(due.getTime() - now.getTime()) > MAX_RANGE_MS) throw new ValidationError("Elige una fecha dentro del próximo año.");
  return due;
}

/** Medianoche (inicio y fin del día) de `now` en la zona de la empresa, como instantes. */
export function dayBounds(now: Date, timezone: string): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(now)
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
  // Lo que marca el reloj de la empresa, leído como si fuera UTC: la diferencia es su desfase.
  const wall = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
  const offset = wall - Math.floor(now.getTime() / 1000) * 1000;
  const start = new Date(Date.UTC(parts.year!, parts.month! - 1, parts.day!) - offset);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** En qué grupo va un seguimiento. */
export function followUpBucket(followUp: Pick<FollowUp, "dueAt" | "doneAt">, now: Date, timezone: string): FollowUpBucket {
  if (followUp.doneAt) return "done";
  const due = new Date(followUp.dueAt).getTime();
  if (due < now.getTime()) return "overdue";
  return due < dayBounds(now, timezone).end.getTime() ? "today" : "upcoming";
}
