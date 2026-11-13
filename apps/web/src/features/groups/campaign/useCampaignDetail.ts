import { useCallback, useEffect, useState } from "react";
import type { CampaignDetailResponse } from "@contracts/GroupContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { RequestError } from "@shared/http/RequestError";
import { groupsApi } from "../services/groupsApi";

/** Mientras se arma el primer grupo, la pantalla se refresca sola. */
const WAITING_REFRESH_MS = 5_000;

export function useCampaignDetail(id: string) {
  const [data, setData] = useState<CampaignDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await groupsApi.campaign(id));
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 404 ? "missing" : "error");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const waiting = data !== null && data.campaign.status === "active" && data.campaign.current === null;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => void refresh(), WAITING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [waiting, refresh]);

  const run = useCallback(
    async (action: () => Promise<unknown>, fallback: string) => {
      setActionError(null);
      try {
        await action();
      } catch (error) {
        setActionError(apiErrorMessage(error, fallback));
      }
      await refresh();
    },
    [refresh]
  );

  return { data, status, actionError, run, refresh };
}
