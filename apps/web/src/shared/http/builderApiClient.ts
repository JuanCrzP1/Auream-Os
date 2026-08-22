import { HttpClient } from "./HttpClient";
import { getBuilderApiBaseUrl } from "../config/getBuilderApiBaseUrl";
import { getDevApiKey } from "../config/getDevApiKey";
import { HttpHeader } from "./HttpHeaders";

/**
 * builderApiClient — instancia compartida del HttpClient para la API.
 *
 * Autenticación: en desarrollo local envía `X-Api-Key` si `VITE_DEV_API_KEY`
 * está definida. En producción no envía ninguna credencial: no existe todavía
 * login real y no se compila ningún secreto en el bundle.
 *
 * Estado: PREPARADO. Cuando exista login, sustituir por `Authorization: Bearer`
 * con el token de la sesión.
 */
export const builderApiClient = new HttpClient({
  baseUrl: getBuilderApiBaseUrl(),
  defaultHeaders: (): Record<string, string> => {
    const devApiKey = getDevApiKey();

    return devApiKey ? { [HttpHeader.XApiKey]: devApiKey } : {};
  }
});
