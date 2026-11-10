import { useEffect, useRef, useState } from "react";
import type { SimulationWait } from "@contracts/SimulationContracts";
import { waitUntil } from "./labModel";

/** Hasta este tiempo, la prueba espera de verdad y sigue sola (como en WhatsApp). Más largo: se adelanta con un toque. */
export const AUTO_CONTINUE_MS = 60_000;

/**
 * Una espera pendiente de la prueba (pausa larga de un Mensaje, Programador o
 * tiempo máximo de una respuesta). Si es corta, cuenta los segundos y la
 * prueba sigue sola al terminar; si es larga, dice cuándo seguiría y deja
 * adelantarla.
 */
export function LabWaitChip({ wait, blockName, onContinue }: { readonly wait: SimulationWait; readonly blockName: string; readonly onContinue: (auto: boolean) => void }) {
  const until = Date.parse(wait.until);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const remaining = Math.max(0, until - now);
  const short = Number.isFinite(until) && until - Date.now() <= AUTO_CONTINUE_MS + 1_000;

  useEffect(() => {
    if (!short) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [short]);

  useEffect(() => {
    if (!short || remaining > 0 || fired.current) return;
    fired.current = true;
    onContinue(true);
  }, [short, remaining, onContinue]);

  const timeout = wait.reason === "timeout";
  if (short) {
    const seconds = Math.ceil(remaining / 1000);
    return (
      <div className="lab-system lab-system--wait" role="status">
        <span className="lab-wait__clock" aria-hidden="true" />
        {timeout ? `Si el cliente no responde, sigue por «Tiempo agotado» en ${seconds} s` : `«${blockName}» continúa en ${seconds} s`}
      </div>
    );
  }
  return (
    <div className="lab-system lab-system--wait">
      {timeout ? `Si el cliente no responde, sigue por «Tiempo agotado» ${waitUntil(wait)}` : `«${blockName}» continúa ${waitUntil(wait)}`}
      <button type="button" className="lab-system__action" onClick={() => onContinue(false)}>
        {timeout ? "Simular que no responde" : "Adelantar espera"}
      </button>
    </div>
  );
}
