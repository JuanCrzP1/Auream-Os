import { useCallback, useEffect, useState } from "react";
import type { AdsAccountsResponse } from "@contracts/AdsContracts";
import { RequestError } from "@shared/http/RequestError";
import { adsApi } from "./adsApi";

export type AdAccountsStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * La conexión con Meta y sus cuentas publicitarias. `forbidden`: el rol no ve
 * los anuncios (solo dueños y administradores). La respuesta del servidor
 * manda: cada acción devuelve el estado nuevo.
 */
export function useAdAccounts() {
  const [data, setData] = useState<AdsAccountsResponse | null>(null);
  const [status, setStatus] = useState<AdAccountsStatus>("loading");

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      setData(await adsApi.accounts());
      setStatus("ready");
      return true;
    } catch (error) {
      const code = error instanceof RequestError ? error.status : 0;
      setStatus(code === 403 ? "forbidden" : code === 503 ? "unavailable" : "error");
      return code === 403 || code === 503;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    // Un fallo pasajero (la sesión renovándose) se reintenta solo: 2 s y 4 s.
    const load = async (attempt: number) => {
      if ((await refresh()) || !alive || attempt >= 2) return;
      timer = window.setTimeout(() => void load(attempt + 1), 2000 * 2 ** attempt);
    };
    void load(0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const apply = useCallback(async (work: Promise<AdsAccountsResponse | void | unknown>) => {
    const result = await work;
    if (result && typeof result === "object" && "accounts" in result) setData(result as AdsAccountsResponse);
    else await refresh();
  }, [refresh]);

  return {
    data,
    status,
    refresh,
    connectToken: (token: string) => apply(adsApi.connectToken(token)),
    setEnabled: (accountId: string, enabled: boolean) => apply(adsApi.setEnabled(accountId, enabled)),
    sync: (accountId: string) => apply(adsApi.sync(accountId)),
    disconnect: () => apply(adsApi.disconnect()),
    /** Va al inicio de sesión de Meta (vuelve a Meta Ads › Cuentas). */
    startOAuth: async () => {
      const { url } = await adsApi.startOAuth();
      window.location.assign(url);
    }
  };
}
