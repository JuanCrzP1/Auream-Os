import { useEffect, useState } from "react";

/**
 * La hora de ahora, al día cada minuto: un cambio programado que empieza o
 * termina se ve en la pantalla sin recargar («Empieza en…» → «Activo ahora»).
 */
export function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
