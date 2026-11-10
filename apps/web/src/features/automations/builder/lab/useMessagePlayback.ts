import { useEffect, useState } from "react";
import type { SimulatedMessage } from "@contracts/SimulationContracts";

// ---------------------------------------------------------------------------
// Reproduce lo que respondió el flujo como lo vería el cliente en WhatsApp:
// un mensaje tras otro, respetando las pausas reales del bloque Mensaje y
// mostrando «escribiendo…» / «grabando audio…» mientras duran. Solo el último
// turno se reproduce; los anteriores ya se ven completos.
// ---------------------------------------------------------------------------

/** Respiro entre dos mensajes seguidos sin pausa (para que se lean de a uno). */
const STAGGER_MS = 280;

export type Presence = "composing" | "recording" | null;

export interface Playback {
  /** Cuántos mensajes del último turno ya se ven. */
  readonly visible: number;
  /** Qué ve el cliente ahora mismo arriba del chat («escribiendo…»). */
  readonly presence: Presence;
  /** Ya se vio todo lo del último turno. */
  readonly done: boolean;
}

export function useMessagePlayback(turnId: number | null, messages: ReadonlyArray<SimulatedMessage>): Playback {
  const [state, setState] = useState<{ turnId: number | null; visible: number }>({ turnId, visible: 0 });
  const visible = state.turnId === turnId ? state.visible : 0;
  const next = messages[visible];

  useEffect(() => {
    if (state.turnId !== turnId) setState({ turnId, visible: 0 });
  }, [state.turnId, turnId]);

  useEffect(() => {
    if (!next || state.turnId !== turnId) return;
    const wait = next.kind === "pause" ? (next.delayMs ?? 0) : STAGGER_MS;
    const timer = window.setTimeout(() => setState({ turnId, visible: visible + 1 }), wait);
    return () => window.clearTimeout(timer);
  }, [next, state.turnId, turnId, visible]);

  const presence: Presence = next ? (next.kind === "pause" ? (next.presence ?? "composing") : "composing") : null;
  return { visible, presence, done: !next };
}
