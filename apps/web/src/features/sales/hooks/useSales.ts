import { useCallback, useEffect, useRef, useState } from "react";
import type { SaleFilters, SaleListResponse, SaleSummary, UpdateSaleRequest } from "@contracts/SalesContracts";
import { RequestError } from "@shared/http/RequestError";
import { fetchSales, updateSale } from "../services/salesApi";

export type SalesStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * Las ventas con unos filtros: la primera página, «Ver más» y corregir
 * (después se vuelve a pedir: la lista y los totales del servidor mandan).
 * Una respuesta vieja nunca pisa a una nueva.
 */
export function useSales(filters: SaleFilters) {
  const [data, setData] = useState<SaleListResponse | null>(null);
  const [status, setStatus] = useState<SalesStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);
  const key = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    const id = ++request.current;
    setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const response = await fetchSales(JSON.parse(key) as SaleFilters);
      if (id !== request.current) return;
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (id !== request.current) return;
      const code = error instanceof RequestError ? error.status : 0;
      setStatus(code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error");
    }
  }, [key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const next = await fetchSales({ ...(JSON.parse(key) as SaleFilters), cursor: data.nextCursor });
      setData((current) => (current ? { ...next, sales: [...current.sales, ...next.sales] } : next));
    } finally {
      setLoadingMore(false);
    }
  }, [data?.nextCursor, key]);

  const update = useCallback(
    async (id: string, input: UpdateSaleRequest): Promise<SaleSummary> => {
      const sale = await updateSale(id, input);
      await refresh();
      return sale;
    },
    [refresh]
  );

  return { data, status, loadingMore, refresh, loadMore, update };
}

export type SalesState = ReturnType<typeof useSales>;
