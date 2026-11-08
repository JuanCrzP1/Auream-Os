import type { AiModelOption, AiProviderId } from "../../../../contracts/AiContracts";

/**
 * Lo que el dominio necesita de un proveedor de IA para administrar
 * conexiones: comprobar una clave y listar los modelos que esa cuenta puede
 * usar. Lo implementan los clientes de `infrastructure/ai`.
 */
export type AiKeyCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid_key" | "unavailable"; readonly message: string };

export type AiModelList =
  | { readonly ok: true; readonly models: ReadonlyArray<AiModelOption> }
  | { readonly ok: false; readonly reason: "invalid_key" | "unavailable"; readonly message: string };

export interface AiProviderAccess {
  verifyKey(provider: AiProviderId, apiKey: string): Promise<AiKeyCheck>;
  listModels(provider: AiProviderId, apiKey: string): Promise<AiModelList>;
}
