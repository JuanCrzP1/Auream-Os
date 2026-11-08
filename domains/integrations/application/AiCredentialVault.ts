import type { AiProviderId } from "../../../contracts/AiContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { secretContext } from "../domain/AiCredential";
import type { AiCredentialRepository } from "./AiCredentialRepository";

/**
 * El único punto que descifra una clave para USARLA (llamar al modelo desde un
 * flujo o desde «Probar»). Solo dentro de la cuenta dueña; nunca la expone en
 * respuestas ni la registra.
 */
export interface RevealedAiCredential {
  readonly provider: AiProviderId;
  readonly apiKey: string;
  readonly status: "active" | "invalid";
}

export class AiCredentialVault {
  public constructor(
    private readonly repository: AiCredentialRepository,
    private readonly cipher: SecretCipher
  ) {}

  public async reveal(tenantId: string, credentialId: string): Promise<RevealedAiCredential | null> {
    const credential = await this.repository.findById(tenantId, credentialId);
    if (!credential) return null;
    return {
      provider: credential.provider,
      apiKey: this.cipher.decrypt(credential.secret, secretContext(tenantId, credentialId)),
      status: credential.status
    };
  }
}
