import type { AutomationListResponse } from "@contracts/AutomationContracts";
import { builderApiClient } from "@shared/http/builderApiClient";
import { RequestError } from "@shared/http/RequestError";

/**
 * fetchAutomationList — obtiene la lista de flows y carpetas del tenant.
 *
 * NO envía el tenant: el servidor lo resuelve desde la identidad autenticada.
 * Enviarlo desde el cliente sería una fuente de tenant no confiable, y la API
 * lo ignora por diseño.
 *
 * Usa builderApiClient: ningún fetch() directo en servicios.
 * Degrada limpiamente a lista vacía si el servidor no está disponible (dev)
 * o si el recurso no existe (404).
 */
export async function fetchAutomationList(): Promise<AutomationListResponse> {
  try {
    return await builderApiClient.get<AutomationListResponse>("/automations");
  } catch (error) {
    // Servidor no disponible en desarrollo → degradar sin error visible
    if (error instanceof TypeError) {
      return { flows: [], folders: [] };
    }

    // 404 → tenant sin flows aún
    if (error instanceof RequestError && error.status === 404) {
      return { flows: [], folders: [] };
    }

    throw error;
  }
}

