import type { SimulationEvent, SimulationStatus, SimulationTurnResponse, SimulationWait } from "@contracts/SimulationContracts";

// ---------------------------------------------------------------------------
// El laboratorio como datos (puro): cada turno es lo que hizo el probador y lo
// que respondió el flujo. De ahí salen la conversación, el recorrido, el
// estado y lo que se ilumina en el lienzo.
// ---------------------------------------------------------------------------

export interface LabTurn {
  readonly id: number;
  readonly event: SimulationEvent;
  readonly response: SimulationTurnResponse;
  /** Cuándo pasó (la hora de las burbujas). */
  readonly at: Date;
  /** Una espera que terminó sola (no la adelantó el probador). */
  readonly auto?: boolean;
}

/** Lo que dijo el probador en ese turno (vacío si no dijo nada: iniciar, saltar espera). */
export function turnInput(event: SimulationEvent): string | null {
  if (event.type === "message") return event.text;
  if (event.type === "choice") return event.title;
  return null;
}

export function turnTitle(turn: LabTurn): string {
  if (turn.event.type === "start") return "Inicio de la prueba";
  if (turn.event.type === "skip-wait") return turn.auto ? "Terminó la espera" : "Se adelantó la espera";
  return `Respondió «${turnInput(turn.event)}»`;
}

export const STATUS_LABEL: Readonly<Record<SimulationStatus, string>> = {
  waiting_reply: "Esperando respuesta",
  waiting_timer: "En espera",
  finished: "Terminó",
  failed: "Falló"
};

const timeFormat = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** «a las 3:45 p. m.» (hoy) o «el 12 nov., 9:00 a. m.». */
export function waitUntil(wait: SimulationWait, now = new Date()): string {
  const at = new Date(wait.until);
  if (Number.isNaN(at.getTime())) return "más tarde";
  return at.toDateString() === now.toDateString() ? `a las ${timeFormat.format(at)}` : `el ${dateFormat.format(at)}`;
}

/** Qué iluminar en el lienzo: los bloques del último turno y dónde espera la prueba. */
export function canvasTrail(turns: ReadonlyArray<LabTurn>): { readonly visited: ReadonlySet<string>; readonly current: string | null } {
  const last = turns[turns.length - 1];
  if (!last) return { visited: new Set(), current: null };
  const session = last.response.state.session;
  const waiting = last.response.status === "waiting_reply" || last.response.status === "waiting_timer";
  return { visited: new Set(last.response.steps.map((step) => step.nodeId)), current: waiting && session ? session.currentNodeId : null };
}
