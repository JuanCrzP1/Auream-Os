import type { IntegrationTestRequest, IntegrationTestResult } from "@contracts/IntegrationTestContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import type { IntegrationTestOutcome } from "../tools/ToolResources";
import { requestBuilderApi } from "./requestBuilderApi";

/**
 * «Probar» del bloque Integración. Nunca lanza: un fallo de la API (límite de
 * pruebas, sin conexión…) vuelve como mensaje para el editor. Que el servicio
 * externo responda con error NO es un fallo aquí: es un resultado.
 */
export async function testIntegrationRequest(request: IntegrationTestRequest): Promise<IntegrationTestOutcome> {
  try {
    const result = await requestBuilderApi<IntegrationTestResult>("/api/builder/integrations/test", {
      method: "POST",
      body: JSON.stringify(request)
    });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error, "No se pudo hacer la prueba. Revisa tu conexión e inténtalo de nuevo.") };
  }
}
