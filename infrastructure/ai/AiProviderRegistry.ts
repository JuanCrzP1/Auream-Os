import type { AiProviderId } from "../../contracts/AiContracts";
import type { AiKeyCheck, AiModelList, AiProviderAccess } from "../../domains/integrations/application/ports/AiProviderAccess";
import type { AiProviderClient, FetchLike } from "./AiProviderClient";
import { GeminiClient } from "./GeminiClient";
import { createOpenAiClient, createOpenRouterClient } from "./OpenAiCompatibleClient";

/** Los clientes de los tres proveedores, por id. Cumple el puerto del dominio. */
export class AiProviderRegistry implements AiProviderAccess {
  private readonly clients: ReadonlyMap<AiProviderId, AiProviderClient>;

  public constructor(clients: ReadonlyArray<AiProviderClient>) {
    this.clients = new Map(clients.map((client) => [client.id, client]));
  }

  public client(provider: AiProviderId): AiProviderClient {
    const client = this.clients.get(provider);
    if (!client) throw new Error(`Proveedor de IA sin cliente: ${provider}`);
    return client;
  }

  public verifyKey(provider: AiProviderId, apiKey: string): Promise<AiKeyCheck> {
    return this.client(provider).verifyKey(apiKey);
  }

  public listModels(provider: AiProviderId, apiKey: string): Promise<AiModelList> {
    return this.client(provider).listModels(apiKey);
  }
}

export function createAiProviderRegistry(fetchImpl?: FetchLike): AiProviderRegistry {
  return new AiProviderRegistry([createOpenAiClient(fetchImpl), new GeminiClient(fetchImpl), createOpenRouterClient(fetchImpl)]);
}
