import { useEffect, useRef, useState } from "react";

/**
 * Pide los datos de una pestaña cuando cambian sus filtros. Una respuesta vieja
 * nunca pisa a una nueva; un fallo pasajero (la sesión renovándose) se
 * reintenta solo a los 2 y 4 segundos.
 */
export function useDashboardData<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const id = ++request.current;
    let timer = 0;
    setFailed(false);
    const run = (attempt: number) => {
      loader.current()
        .then((response) => id === request.current && setData(response))
        .catch(() => {
          if (id !== request.current) return;
          if (attempt < 2) timer = window.setTimeout(() => run(attempt + 1), 2000 * 2 ** attempt);
          else setFailed(true);
        });
    };
    run(0);
    return () => window.clearTimeout(timer);
  }, [key]);

  return { data, failed };
}
