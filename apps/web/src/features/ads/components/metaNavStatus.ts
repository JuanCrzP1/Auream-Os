import type { AdsAccountsResponse } from "@contracts/AdsContracts";
import type { AdAccountsStatus } from "@shared/ads/useAdAccounts";
import type { AdsNavStatus } from "./AdsNav";

/** Lo que dicen las tarjetas de Rendimiento y Cuentas según la conexión con Meta. */
export function metaNavStatus(status: AdAccountsStatus, data: AdsAccountsResponse | null): { performance: AdsNavStatus; accounts: AdsNavStatus } {
  if (status === "forbidden") return { performance: { tone: "idle", text: "Solo dueños" }, accounts: { tone: "idle", text: "Solo dueños" } };
  if (!data?.connection.connected) return { performance: { tone: "idle", text: "Esperando tu cuenta" }, accounts: { tone: "idle", text: "Sin conectar" } };
  const enabled = data.accounts.filter((account) => account.enabled);
  const failing = enabled.some((account) => account.lastError) || data.connection.needsReconnect;
  return {
    performance: enabled.length > 0 ? { tone: failing ? "warn" : "ok", text: failing ? "Revisa la conexión" : "Al día" } : { tone: "idle", text: "Elige una cuenta" },
    accounts: failing ? { tone: "warn", text: data.connection.needsReconnect ? "Reconectar" : "Con errores" } : { tone: "ok", text: enabled.length === 1 ? "1 cuenta" : `${enabled.length} cuentas` }
  };
}
