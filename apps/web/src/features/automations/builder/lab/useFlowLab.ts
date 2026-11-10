import { useCallback, useRef, useState } from "react";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import { DEFAULT_SIMULATION_PERSONA, type SimulationEvent, type SimulationOptions, type SimulationPersona, type SimulationState } from "@contracts/SimulationContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { runLabTurn } from "./labApi";
import type { LabTurn } from "./labModel";

// ---------------------------------------------------------------------------
// useFlowLab — una prueba del flujo en el laboratorio. El estado de la prueba
// vive aquí (el servidor no guarda nada): cada turno manda lo que está en el
// lienzo, el estado anterior y lo que hizo el probador, y guarda lo que
// devuelve. El cliente de prueba que define el usuario es la base: reiniciar
// vuelve a él (las etiquetas que pusieron los bloques se van).
// ---------------------------------------------------------------------------

const OPTIONS_KEY = "auream.lab.options";
const DEFAULT_OPTIONS: SimulationOptions = { realAi: true, realIntegrations: false };

function loadOptions(): SimulationOptions {
  try {
    const saved = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) ?? "null") as Partial<SimulationOptions> | null;
    return { realAi: saved?.realAi ?? DEFAULT_OPTIONS.realAi, realIntegrations: saved?.realIntegrations ?? DEFAULT_OPTIONS.realIntegrations };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function useFlowLab(flowKey: string, getDraft: () => BuilderFlowSnapshot | null) {
  const [turns, setTurns] = useState<LabTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptionsState] = useState<SimulationOptions>(loadOptions);
  const [basePersona, setBasePersona] = useState<SimulationPersona>(DEFAULT_SIMULATION_PERSONA);
  const [persona, setPersona] = useState<SimulationPersona>(DEFAULT_SIMULATION_PERSONA);
  const state = useRef<SimulationState | null>(null);
  const nextId = useRef(1);

  const send = useCallback(
    async (event: SimulationEvent, meta: { readonly auto?: boolean } = {}) => {
      const draft = getDraft();
      if (busy || !draft) return;
      setBusy(true);
      setError(null);
      const previous = event.type === "start" ? null : state.current;
      const request = { draft, event, options, state: { session: previous?.session ?? null, wait: previous?.wait ?? null, counters: previous?.counters ?? {}, persona } };
      try {
        const response = await runLabTurn(flowKey, request);
        state.current = response.state;
        setPersona(response.state.persona);
        const turn = { id: nextId.current++, event, response, at: new Date(), ...(meta.auto ? { auto: true } : {}) };
        setTurns((current) => [...(event.type === "start" ? [] : current), turn]);
      } catch (e) {
        setError(apiErrorMessage(e, "No se pudo ejecutar la prueba. Revisa tu conexión e inténtalo de nuevo."));
      } finally {
        setBusy(false);
      }
    },
    [busy, flowKey, getDraft, options, persona]
  );

  const reset = useCallback(() => {
    state.current = null;
    setTurns([]);
    setError(null);
    setPersona(basePersona);
  }, [basePersona]);

  const setOptions = useCallback((next: SimulationOptions) => {
    setOptionsState(next);
    try {
      window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento: vale para esta sesión */
    }
  }, []);

  /** Cambia el cliente de prueba (nombre, teléfono): vale desde el próximo turno y al reiniciar. */
  const updatePersona = useCallback((next: SimulationPersona) => {
    setBasePersona(next);
    setPersona(next);
  }, []);

  const last = turns[turns.length - 1] ?? null;
  return { turns, last, busy, error, options, setOptions, persona, updatePersona, send, reset };
}

export type FlowLab = ReturnType<typeof useFlowLab>;
