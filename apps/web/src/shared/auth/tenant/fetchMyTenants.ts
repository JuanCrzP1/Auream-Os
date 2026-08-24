import type { MyTenantsResponse } from "@contracts/TenancyContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

/** Tenants del usuario autenticado. El servidor los deriva de su identidad. */
export async function fetchMyTenants(): Promise<MyTenantsResponse> {
  return builderApiClient.get<MyTenantsResponse>("/me/tenants");
}

/**
 * Garantiza que el usuario tenga un tenant inicial.
 *
 * Idempotente en el servidor: llamarlo tras cada login o recarga no crea
 * duplicados.
 */
export async function ensureOnboarding(): Promise<void> {
  await builderApiClient.post<unknown>("/me/onboarding");
}
