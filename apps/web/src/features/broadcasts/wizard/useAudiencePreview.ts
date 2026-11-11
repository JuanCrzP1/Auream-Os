import { useEffect, useState } from "react";
import type { AudienceFilter } from "@contracts/BroadcastContracts";
import type { AudiencePreview } from "@contracts/BroadcastResultsContracts";
import { broadcastsApi } from "../services/broadcastsApi";

const WAIT_MS = 350;

/** A cuántos les llega, en vivo mientras se eligen los filtros (espera a que se deje de tocar). */
export function useAudiencePreview(audience: AudienceFilter, connectionIds: ReadonlyArray<string>, dailyCap: number) {
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([audience, connectionIds, dailyCap]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      broadcastsApi
        .preview(audience, connectionIds, dailyCap)
        .then((result) => !cancelled && setPreview(result))
        .catch(() => !cancelled && setPreview(null))
        .finally(() => !cancelled && setLoading(false));
    }, WAIT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { preview, loading };
}
