import { useCallback, useEffect, useState } from "react";
import type { BroadcastDetailResponse } from "@contracts/BroadcastResultsContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { RequestError } from "@shared/http/RequestError";
import { broadcastsApi } from "../services/broadcastsApi";

/** Mientras envía, la pantalla se refresca sola. */
const LIVE_REFRESH_MS = 5_000;

export function useBroadcastDetail(id: string) {
  const [data, setData] = useState<BroadcastDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setData(await broadcastsApi.detail(id));
      setStatus("ready");
      setVersion((v) => v + 1);
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 404 ? "missing" : "error");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const live = data?.broadcast.status === "sending";
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void refresh(), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, refresh]);

  const act = useCallback(
    async (action: "pause" | "resume" | "cancel") => {
      setActionError(null);
      try {
        await broadcastsApi.act(id, action);
      } catch (error) {
        setActionError(apiErrorMessage(error, "No se pudo hacer ese cambio."));
      }
      await refresh();
    },
    [id, refresh]
  );

  return { data, status, act, actionError, version };
}
