import { useEffect, useState } from "react";
import type { FxRatesResponse } from "@contracts/DashboardContracts";
import { dashboardApi } from "../services/dashboardApi";

/** Las tasas oficiales más recientes, al abrir el menú de moneda. Si no llegan, `null` (el menú sigue sirviendo). */
export function useFxRates(): FxRatesResponse | null {
  const [fx, setFx] = useState<FxRatesResponse | null>(null);
  useEffect(() => {
    let alive = true;
    dashboardApi.fx().then((response) => alive && setFx(response)).catch(() => alive && setFx(null));
    return () => {
      alive = false;
    };
  }, []);
  return fx;
}
