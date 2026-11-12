import { useCallback, useEffect, useState } from "react";
import type { SalesLineSummary, SaveSalesLineRequest } from "@contracts/SalesLineContracts";
import { salesLinesApi } from "./salesLinesApi";

/**
 * Las líneas de venta de la cuenta y si quien mira puede organizarlas. Si la
 * API no las ofrece (sin permiso o sin el módulo), queda vacío: el Dashboard
 * sigue funcionando sin líneas.
 */
export function useSalesLines() {
  const [lines, setLines] = useState<ReadonlyArray<SalesLineSummary>>([]);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await salesLinesApi.list();
      setLines(response.lines);
      setCanManage(response.canManage);
    } catch {
      setLines([]);
      setCanManage(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (request: SaveSalesLineRequest, lineId?: string) => {
      const saved = lineId ? await salesLinesApi.update(lineId, request) : await salesLinesApi.create(request);
      await refresh();
      return saved;
    },
    [refresh]
  );

  const remove = useCallback(
    async (lineId: string) => {
      await salesLinesApi.remove(lineId);
      await refresh();
    },
    [refresh]
  );

  return { lines, canManage, save, remove };
}
