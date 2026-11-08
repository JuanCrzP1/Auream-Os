import type { AiProviderId } from "../../contracts/AiContracts";
import type { AiKeyCheck, AiModelList } from "../../domains/integrations/application/ports/AiProviderAccess";
import type { AiGenerateResult, AiMessage } from "../../flow-engine/ports/AiGateway";

/** Una llamada a un modelo, ya con la clave en claro (solo vive en memoria). */
export interface AiChatRequest {
  readonly apiKey: string;
  readonly model: string;
  readonly system: string;
  readonly messages: ReadonlyArray<AiMessage>;
  readonly json: boolean;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

/** Cliente de UN proveedor. Nunca lanza: todo fallo vuelve con su motivo. */
export interface AiProviderClient {
  readonly id: AiProviderId;
  chat(request: AiChatRequest): Promise<AiGenerateResult>;
  verifyKey(apiKey: string): Promise<AiKeyCheck>;
  listModels(apiKey: string): Promise<AiModelList>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
