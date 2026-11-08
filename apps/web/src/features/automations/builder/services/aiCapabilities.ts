import type { AiCredentialSummary, AiModelOption, CreateAiCredentialRequest } from "@contracts/AiContracts";
import type { AiTestRequest, AiTestResult } from "@contracts/AiTestContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { fetchAiModels } from "@shared/ai-credentials/aiCredentialsApi";
import type { ToolOutcome } from "../tools/ToolResources";
import { requestBuilderApi } from "./requestBuilderApi";

// Capacidades de IA para el editor del bloque. Nunca lanzan: devuelven el dato
// o un mensaje listo para mostrar.

async function outcome<T>(run: () => Promise<T>, fallback: string): Promise<ToolOutcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error, fallback) };
  }
}

export function listAiModels(credentialId: string): Promise<ToolOutcome<ReadonlyArray<AiModelOption>>> {
  return outcome(() => fetchAiModels(credentialId), "No se pudo leer la lista de modelos.");
}

export function testAiStep(request: AiTestRequest): Promise<ToolOutcome<AiTestResult>> {
  return outcome(
    () => requestBuilderApi<AiTestResult>("/api/builder/ai/test", { method: "POST", body: JSON.stringify(request) }),
    "No se pudo hacer la prueba. Revisa tu conexión e inténtalo de nuevo."
  );
}

export function connectAi(create: (request: CreateAiCredentialRequest) => Promise<AiCredentialSummary>) {
  return (request: CreateAiCredentialRequest) => outcome(() => create(request), "No se pudo conectar. Inténtalo de nuevo.");
}
