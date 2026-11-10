import type { PixelTestRequest, PixelTestResult } from "@contracts/PixelTestContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import type { ToolOutcome } from "../tools/ToolResources";
import { requestBuilderApi } from "./requestBuilderApi";

// Capacidades del bloque Pixel para su editor. Nunca lanzan. Conectar píxeles
// no es una de ellas: eso se hace solo en Meta Ads.

export async function testPixelEvent(request: PixelTestRequest): Promise<ToolOutcome<PixelTestResult>> {
  try {
    return { ok: true, value: await requestBuilderApi<PixelTestResult>("/api/builder/pixel/test", { method: "POST", body: JSON.stringify(request) }) };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error, "No se pudo enviar la prueba. Revisa tu conexión e inténtalo de nuevo.") };
  }
}
