import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { pixelSecretContext } from "../domain/PixelConnection";
import type { PixelConnectionRepository } from "./PixelConnectionRepository";

/**
 * El único punto que descifra un token de píxel para USARLO (enviar un
 * evento). Solo dentro de la cuenta dueña; nunca lo expone ni lo registra.
 */
export interface RevealedPixelConnection {
  readonly pixelId: string;
  readonly accessToken: string;
  readonly status: "active" | "invalid";
}

export class PixelConnectionVault {
  public constructor(
    private readonly repository: PixelConnectionRepository,
    private readonly cipher: SecretCipher
  ) {}

  public async reveal(tenantId: string, connectionId: string): Promise<RevealedPixelConnection | null> {
    const connection = await this.repository.findById(tenantId, connectionId);
    if (!connection) return null;
    return {
      pixelId: connection.pixelId,
      accessToken: this.cipher.decrypt(connection.secret, pixelSecretContext(tenantId, connectionId)),
      status: connection.status
    };
  }
}
