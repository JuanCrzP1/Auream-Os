import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardFilters, BoardResponse, DealCard } from "@contracts/CrmContracts";
import { crmApi } from "../services/crmApi";

/**
 * El tablero de un embudo. Mover a alguien se ve AL INSTANTE (la tarjeta
 * cambia de columna) y luego se confirma con el servidor; si falla, vuelve a
 * su sitio y se avisa. Una respuesta vieja nunca pisa a una nueva.
 */
export function useBoard(pipelineId: string | null, filters: BoardFilters, refreshKey: number) {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const request = useRef(0);
  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    const id = ++request.current;
    try {
      const response = await crmApi.board(pipelineId, JSON.parse(key) as BoardFilters);
      if (id !== request.current) return;
      setBoard(response);
      setStatus("ready");
    } catch {
      if (id === request.current) setStatus("error");
    }
  }, [pipelineId, key]);

  useEffect(() => {
    setStatus("loading");
    void load();
  }, [load, refreshKey]);

  /** Mueve la tarjeta en pantalla y en el servidor. Devuelve el error, si hubo. */
  const move = useCallback(
    async (card: DealCard, stageId: string, reason?: string): Promise<unknown> => {
      if (!pipelineId || card.stageId === stageId) return null;
      setBoard((current) => (current ? moveCard(current, card, stageId) : current));
      try {
        await crmApi.move(pipelineId, card.contactId, { stageId, ...(reason ? { reason } : {}) });
        await load();
        return null;
      } catch (error) {
        await load();
        return error;
      }
    },
    [pipelineId, load]
  );

  return { board, status, reload: load, move };
}

/** La tarjeta sale de su columna y entra arriba de la otra (los números se corrigen al recargar). */
export function moveCard(board: BoardResponse, card: DealCard, stageId: string): BoardResponse {
  const moved: DealCard = { ...card, stageId, enteredAt: new Date().toISOString() };
  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.stageId === card.stageId) return { ...column, count: Math.max(0, column.count - 1), cards: column.cards.filter((candidate) => candidate.contactId !== card.contactId) };
      if (column.stageId === stageId) return { ...column, count: column.count + 1, cards: [moved, ...column.cards] };
      return column;
    })
  };
}
