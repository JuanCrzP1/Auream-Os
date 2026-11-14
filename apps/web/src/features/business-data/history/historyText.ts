import { BUSINESS_DATA_TYPE_LABEL, businessValueText, type BusinessDataType } from "@contracts/BusinessDataContracts";
import type { BusinessDataChange, ScheduleSnapshot } from "@contracts/BusinessDataTimeline";

// ---------------------------------------------------------------------------
// Cómo se lee cada línea del historial de un dato: quién, qué hizo y los
// valores como los lee una persona («Sí», «1.200», «24/12/2026»). Puro.
// ---------------------------------------------------------------------------

/** Un trozo de la frase: texto normal, el valor de antes (tachado) o el de después (resaltado). */
export interface HistoryPiece {
  readonly text: string;
  readonly mark?: "before" | "after" | "name";
}

export interface HistoryLine {
  readonly who: string;
  readonly pieces: ReadonlyArray<HistoryPiece>;
  /** Para un programado: sus fechas. */
  readonly schedule?: ScheduleSnapshot;
  /** «Volver a este valor»: el valor de antes de un cambio de valor (o con el que se creó). */
  readonly restore?: string;
}

const UNKNOWN = "Alguien del equipo";
const quote = (text: string) => `«${text}»`;
const shown = (type: BusinessDataType, value: string) => quote(businessValueText({ type, value }));
const named = (schedule: ScheduleSnapshot) => (schedule.note ? `${quote(schedule.note)}` : "un cambio");

export function historyLine(change: BusinessDataChange): HistoryLine {
  const who = change.actorName?.trim() || UNKNOWN;
  const type = change.valueType;
  switch (change.kind) {
    case "created":
      return { who, pieces: [{ text: " lo creó con " }, { text: shown(type, change.value), mark: "after" }], restore: change.value };
    case "value":
      return { who, pieces: [{ text: " cambió el valor de " }, { text: shown(type, change.before), mark: "before" }, { text: " a " }, { text: shown(type, change.after), mark: "after" }], restore: change.before };
    case "label":
      return { who, pieces: [{ text: " cambió el nombre de " }, { text: quote(change.before), mark: "before" }, { text: " a " }, { text: quote(change.after), mark: "after" }] };
    case "description":
      return change.after
        ? { who, pieces: [{ text: " cambió para qué es: " }, { text: quote(change.after), mark: "after" }] }
        : { who, pieces: [{ text: " quitó para qué es" }] };
    case "type":
      return { who, pieces: [{ text: " cambió el tipo de " }, { text: BUSINESS_DATA_TYPE_LABEL[change.before], mark: "before" }, { text: " a " }, { text: BUSINESS_DATA_TYPE_LABEL[change.after], mark: "after" }] };
    case "scheduled":
      return { who, pieces: [{ text: " programó " }, { text: named(change.schedule), mark: "name" }, { text: ": " }, { text: shown(type, change.schedule.value), mark: "after" }], schedule: change.schedule };
    case "rescheduled":
      return { who, pieces: [{ text: " editó " }, { text: named(change.after), mark: "name" }, ...(change.before.value !== change.after.value ? [{ text: ": " }, { text: shown(type, change.before.value), mark: "before" as const }, { text: " → " }, { text: shown(type, change.after.value), mark: "after" as const }] : [])], schedule: change.after };
    case "unscheduled":
      return { who, pieces: [{ text: " quitó " }, { text: named(change.schedule), mark: "name" }], schedule: change.schedule };
    case "ended":
      return { who, pieces: [{ text: " terminó antes " }, { text: named(change.schedule), mark: "name" }, { text: ": volvió el valor de siempre" }], schedule: change.schedule };
    case "deleted":
      return { who, pieces: [{ text: " lo borró. Valía " }, { text: shown(type, change.value), mark: "before" }] };
  }
}

/** La inicial del avatar («C» de Camilo). */
export const initialOf = (who: string) => (who === UNKNOWN ? "·" : who.trim().charAt(0).toUpperCase() || "·");
