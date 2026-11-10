import { useEffect, useRef, useState } from "react";
import type { SaleFilters } from "@contracts/SalesContracts";
import type { SalesInsightsResponse } from "@contracts/SalesInsightsContracts";
import { fetchSalesInsights } from "../services/salesApi";

/**
 * La portada del periodo (tendencia, curva, lo que más vende). Se vuelve a
 * pedir cuando cambian los filtros o `refreshKey` (se anotó o corrigió una
 * venta). Una respuesta vieja nunca pisa a una nueva; si falla tres veces, la
 * portada se oculta y la tabla sigue funcionando.
 */
export function useSalesInsights(filters: Pick<SaleFilters, "from" | "to" | "productId">, refreshKey: number) {
  const [insights, setInsights] = useState<SalesInsightsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const key = JSON.stringify(filters);

  useEffect(() => {
    const id = ++request.current;
    let timer = 0;
    // Un fallo pasajero (la sesión renovándose al abrir, la base despertando) se reintenta solo: 2 s, 4 s y 8 s.
    const load = (attempt: number) => {
      fetchSalesInsights(JSON.parse(key) as typeof filters)
        .then((response) => {
          if (id !== request.current) return;
          setInsights(response);
          setFailed(false);
        })
        .catch(() => {
          if (id !== request.current) return;
          if (attempt < 3) timer = window.setTimeout(() => load(attempt + 1), 2000 * 2 ** attempt);
          else setFailed(true);
        });
    };
    load(0);
    return () => window.clearTimeout(timer);
  }, [key, refreshKey]);

  return { insights, failed };
}
