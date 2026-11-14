import type { BusinessDataChangeDetail, ScheduleSnapshot } from "../../../contracts/BusinessDataTimeline";
import type { DatumShape } from "./BusinessDatum";
import type { ScheduleShape } from "./DatumSchedule";

// ---------------------------------------------------------------------------
// Qué anota el historial de un dato del negocio: una línea por cada cosa que
// cambió («cambió el valor de "8 a 6" a "9 a 7"»), en el orden en que se lee
// el detalle. Puro.
// ---------------------------------------------------------------------------

/** Lo que cambió entre dos versiones del dato (nada si no cambió nada). */
export function datumChanges(before: DatumShape, after: DatumShape): BusinessDataChangeDetail[] {
  const changes: BusinessDataChangeDetail[] = [];
  if (before.label !== after.label) changes.push({ kind: "label", before: before.label, after: after.label });
  if (before.type !== after.type) changes.push({ kind: "type", before: before.type, after: after.type });
  if (before.value !== after.value) changes.push({ kind: "value", before: before.value, after: after.value });
  if (before.description !== after.description) changes.push({ kind: "description", before: before.description, after: after.description });
  return changes;
}

/** Un cambio programado como lo recuerda el historial. */
export function scheduleSnapshot(schedule: ScheduleShape | ScheduleSnapshot): ScheduleSnapshot {
  const iso = (at: Date | string) => (typeof at === "string" ? at : at.toISOString());
  return { value: schedule.value, startsAt: iso(schedule.startsAt), endsAt: iso(schedule.endsAt), note: schedule.note };
}

/** ¿Cambió algo del programado? (guardar sin tocar nada no deja línea). */
export function scheduleChanged(before: ScheduleSnapshot, after: ScheduleSnapshot): boolean {
  return before.value !== after.value || before.startsAt !== after.startsAt || before.endsAt !== after.endsAt || before.note !== after.note;
}
