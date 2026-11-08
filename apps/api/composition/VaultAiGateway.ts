import type { AiCredentialVault } from "../../../domains/integrations/application/AiCredentialVault";
import type { AiGateway, AiGenerateRequest, AiGenerateResult } from "../../../flow-engine/ports/AiGateway";
import type { AiProviderRegistry } from "../../../infrastructure/ai/AiProviderRegistry";
import { SecretDecryptionError } from "../../../platform/security/secrets/SecretCipher";

// ---------------------------------------------------------------------------
// Adaptador del puerto `AiGateway`: descifra la clave de la conexión (solo en
// su cuenta) y llama al proveedor que corresponde. La clave vive en memoria
// lo que dura la llamada; no se devuelve ni se registra.
// ---------------------------------------------------------------------------

export class VaultAiGateway implements AiGateway {
  public constructor(
    private readonly vault: AiCredentialVault,
    private readonly providers: AiProviderRegistry
  ) {}

  public async generate(tenantId: string, request: AiGenerateRequest): Promise<AiGenerateResult> {
    let credential;
    try {
      credential = await this.vault.reveal(tenantId, request.credentialId);
    } catch (error) {
      if (error instanceof SecretDecryptionError) {
        return { ok: false, reason: "invalid_key", message: "No se pudo leer la clave de la conexión de IA; vuelve a guardarla." };
      }
      throw error;
    }
    if (!credential) {
      return { ok: false, reason: "credential_not_found", message: "La conexión de IA del bloque ya no existe; elige otra." };
    }

    const { credentialId: _credentialId, ...chat } = request;
    return this.providers.client(credential.provider).chat({ ...chat, apiKey: credential.apiKey });
  }
}
