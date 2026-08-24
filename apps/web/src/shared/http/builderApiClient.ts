import { HttpClient } from "./HttpClient";
import { getBuilderApiBaseUrl } from "../config/getBuilderApiBaseUrl";
import { getDevApiKey } from "../config/getDevApiKey";
import { tokenStore } from "../auth/client/tokenStore";
import { activeTenantStore } from "../auth/tenant/activeTenantStore";
import { HttpHeader } from "./HttpHeaders";

/**
 * builderApiClient — instancia compartida del HttpClient para la API.
 *
 * Autenticación por orden de preferencia:
 *   1. `Authorization: Bearer <jwt>` cuando hay sesión de usuario.
 *   2. `X-Api-Key` en desarrollo, para trabajar sin iniciar sesión.
 *
 * `X-Tenant-Id` viaja como SELECCIÓN del tenant activo. El servidor la valida
 * contra una membership real: enviarla no concede ningún acceso por sí sola.
 */
export const builderApiClient = new HttpClient({
  baseUrl: getBuilderApiBaseUrl(),
  defaultHeaders: async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};

    const tenantId = activeTenantStore.read();

    if (tenantId) {
      headers[HttpHeader.XTenantId] = tenantId;
    }

    const token = await tokenStore.get();

    if (token) {
      headers[HttpHeader.Authorization] = `Bearer ${token}`;
      return headers;
    }

    // Sin sesión de usuario: en desarrollo se recurre a la API key local.
    const devApiKey = getDevApiKey();

    if (devApiKey) {
      headers[HttpHeader.XApiKey] = devApiKey;
    }

    return headers;
  }
});
