import { useEffect, useRef, useState } from "react";
import type { SimulationWait } from "@contracts/SimulationContracts";
import { formatRemaining, waitTarget, waitUntil } from "./labModel";

/** Más que esto no se programa de una vez (límite de `setTimeout`); el reloj de cada segundo lo cubre. */
const MAX_TIMEOUT_MS = 2_000_000_000;

/**
 * Una espera pendiente de la prueba (pausa larga de un Mensaje, Programador o
 * tiempo máximo de una respuesta). Como en la vida real, la prueba SIGUE SOLA
 * justo a la hora, dure lo que dure: cuenta el tiempo que falta y, al llegar,
 * continúa. «Adelantar espera» sirve para no esperar.
 *
 * La hora viene del reloj del servidor (`clockOffsetMs` corrige la diferencia
 * con el de este equipo). Si la pestaña estuvo en segundo plano (el navegador
 * frena sus relojes), al volver se revisa la hora enseguida.
 */
export function LabWaitChip({
  wait,
  clockOffsetMs,
  blockName,
  onContinue
}: {
  readonly wait: SimulationWait;
  readonly clockOffsetMs: number;
  readonly blockName: string;
  readonly onContinue: (auto: boolean) => void;
}) {
  const target = waitTarget(wait, clockOffsetMs);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  // Cada segundo para la cuenta; un aviso exacto para la hora; y al volver a la pestaña.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const everySecond = window.setInterval(tick, 1_000);
    const atTheTime = window.setTimeout(tick, Math.min(Math.max(0, target - Date.now()), MAX_TIMEOUT_MS));
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(everySecond);
      window.clearTimeout(atTheTime);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [target]);

  const remaining = Number.isFinite(target) ? target - now : 0;
  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    onContinue(true);
  }, [remaining, onContinue]);

  const advance = () => {
    if (fired.current) return;
    fired.current = true;
    onContinue(false);
  };
  const timeout = wait.reason === "timeout";
  const when = remaining > 60_000 ? ` · ${waitUntil(wait)}` : "";
  return (
    <div className="lab-system lab-system--wait" role="status">
      <span className="lab-wait__clock" aria-hidden="true" />
      <span>
        {timeout ? `Si el cliente no responde, sigue por «Tiempo agotado» en ${formatRemaining(remaining)}` : `«${blockName}» continúa en ${formatRemaining(remaining)}`}
        {when}
      </span>
      <button type="button" className="lab-system__action" onClick={advance}>
        {timeout ? "Simular que no responde" : "Adelantar espera"}
      </button>
    </div>
  );
}
