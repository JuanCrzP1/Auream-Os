import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardFilters, DealCard } from "@contracts/CrmContracts";
import { crmApi } from "../services/crmApi";

/** Los clientes de una etapa, de 25 en 25 (la vista Lista). */
export function useStageCards(pipelineId: string | null, stageId: string | null, filters: BoardFilters, refreshKey: number) {
  const [cards, setCards] = useState<ReadonlyArray<DealCard>>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const request = useRef(0);
  const key = JSON.stringify(filters);

  useEffect(() => {
    if (!pipelineId || !stageId) return;
    const id = ++request.current;
    setStatus("loading");
    crmApi
      .stageCards(pipelineId, stageId, JSON.parse(key) as BoardFilters, 0)
      .then((response) => {
        if (id !== request.current) return;
        setCards(response.cards);
        setNextOffset(response.nextOffset);
        setStatus("ready");
      })
      .catch(() => id === request.current && setStatus("error"));
  }, [pipelineId, stageId, key, refreshKey]);

  const more = useCallback(async () => {
    if (!pipelineId || !stageId || nextOffset === null) return;
    const id = request.current;
    const response = await crmApi.stageCards(pipelineId, stageId, JSON.parse(key) as BoardFilters, nextOffset);
    if (id !== request.current) return;
    setCards((current) => [...current, ...response.cards]);
    setNextOffset(response.nextOffset);
  }, [pipelineId, stageId, key, nextOffset]);

  return { cards, status, hasMore: nextOffset !== null, more };
}
