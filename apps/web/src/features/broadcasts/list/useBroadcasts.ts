import { useCallback, useEffect, useState } from "react";
import type { BroadcastListResponse } from "@contracts/BroadcastResultsContracts";
import { RequestError } from "@shared/http/RequestError";
import { broadcastsApi } from "../services/broadcastsApi";

export type BroadcastsStatus = "loading" | "ready" | "forbidden" | "error";

/** Mientras alguna esté enviando, la lista se refresca sola. */
const LIVE_REFRESH_MS = 10_000;

export function useBroadcasts() {
  const [data, setData] = useState<BroadcastListResponse | null>(null);
  const [status, setStatus] = useState<BroadcastsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setData(await broadcastsApi.list());
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const live = data?.broadcasts.some((broadcast) => broadcast.status === "sending") ?? false;
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void refresh(), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, refresh]);

  return { data, status, refresh };
}
