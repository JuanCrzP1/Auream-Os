import type { BusinessDataType } from "./BusinessDataContracts";
import type { ScheduleWhen } from "./ScheduledMessageContracts";

// ---------------------------------------------------------------------------
// Datos del negocio en el tiempo (entrega B):
//
//   · Cambio programado: otro valor entre dos fechas (el horario de Navidad, la
//     cuenta de un festivo). Mientras dura, `{g_…}` dice ese valor en todo
//     (flujos, Condicional, difusiones, respuestas rápidas, MCP); al terminar
//     vuelve solo al de siempre. El valor del momento se decide AL LEER
//     (`valueAt`): no hay tareas que puedan fallar ni llegar tarde.
//   · Historial: quién cambió qué y cuándo, con «Volver a este valor».
//
//   GET    /business-data/:id/history              el historial           flows.read
//   POST   /business-data/:id/schedules            programar un cambio    flows.write
//   PATCH  /business-data/:id/schedules/:sid       editarlo               flows.write
//   DELETE /business-data/:id/schedules/:sid       quitarlo o terminarlo  flows.write
//
// Las horas se eligen en la zona del NEGOCIO (Empresa), igual que los
// mensajes programados del chat. Contrato API ↔ web.
// ---------------------------------------------------------------------------

export const BUSINESS_SCHEDULE_LIMITS = {
  /** Por venir o activos a la vez, por dato. */
  maxOpen: 10,
  maxNote: 60,
  /** Hasta cuántos días adelante puede terminar. */
  maxDaysAhead: 365
} as const;

/** Lo que se guarda del historial por dato (los más recientes). */
export const BUSINESS_HISTORY_LIMIT = 50;

export interface BusinessDataSchedule {
  readonly id: string;
  /** Guardado «a lo computador», como el valor de siempre. */
  readonly value: string;
  /** Desde (incluido) y hasta (sin incluir), ISO. */
  readonly startsAt: string;
  readonly endsAt: string;
  /** Para qué es: «Navidad». */
  readonly note: string;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

export type ScheduleState = "upcoming" | "active" | "ended";

export function scheduleState(schedule: Pick<BusinessDataSchedule, "startsAt" | "endsAt">, now: Date): ScheduleState {
  const at = now.getTime();
  if (at < Date.parse(schedule.startsAt)) return "upcoming";
  return at < Date.parse(schedule.endsAt) ? "active" : "ended";
}

/** El cambio que rige en este momento, si hay uno. */
export function activeSchedule<T extends Pick<BusinessDataSchedule, "startsAt" | "endsAt">>(schedules: ReadonlyArray<T> | undefined, now: Date): T | undefined {
  return schedules?.find((schedule) => scheduleState(schedule, now) === "active");
}

/** El valor que dice `{g_…}` en ese momento: el programado si rige uno, si no el de siempre. */
export function valueAt(datum: { readonly value: string; readonly schedules?: ReadonlyArray<Pick<BusinessDataSchedule, "value" | "startsAt" | "endsAt">> }, now: Date): string {
  return activeSchedule(datum.schedules, now)?.value ?? datum.value;
}

/** Programar o editar: fechas y horas en la zona del negocio; el valor como lo escribe una persona. */
export interface SaveBusinessScheduleRequest {
  readonly value: string;
  readonly from: ScheduleWhen;
  readonly until: ScheduleWhen;
  readonly note?: string;
}

/** Lo que el historial recuerda de un cambio programado. */
export type ScheduleSnapshot = Pick<BusinessDataSchedule, "value" | "startsAt" | "endsAt" | "note">;

/**
 *   created          se creó con `value`
 *   value/label/type/description   cambió de `before` a `after`
 *   scheduled        programó un cambio · `rescheduled` lo editó
 *   unscheduled      quitó uno que no había empezado · `ended` terminó antes uno activo
 *   deleted          lo borraron (si se crea otra vez con la misma clave, se ve su pasado)
 */
export type BusinessDataChangeDetail =
  | { readonly kind: "created"; readonly value: string }
  | { readonly kind: "value" | "label" | "description"; readonly before: string; readonly after: string }
  | { readonly kind: "type"; readonly before: BusinessDataType; readonly after: BusinessDataType }
  | { readonly kind: "scheduled" | "unscheduled" | "ended"; readonly schedule: ScheduleSnapshot }
  | { readonly kind: "rescheduled"; readonly before: ScheduleSnapshot; readonly after: ScheduleSnapshot }
  | { readonly kind: "deleted"; readonly value: string };

export type BusinessDataChangeKind = BusinessDataChangeDetail["kind"];

export type BusinessDataChange = BusinessDataChangeDetail & {
  readonly id: string;
  readonly at: string;
  /** Su nombre en Mi perfil (o su correo); `null` si ya no está en el equipo. */
  readonly actorName: string | null;
  /** El tipo del dato cuando pasó: para leer «true» como «Sí». */
  readonly valueType: BusinessDataType;
};

export interface BusinessDataHistoryResponse {
  readonly changes: ReadonlyArray<BusinessDataChange>;
}
