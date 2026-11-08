import type { PixelConnectionVault } from "../../../domains/integrations/application/PixelConnectionVault";
import type { ConversionTracker, TrackConversionRequest, TrackConversionResult } from "../../../flow-engine/ports/ConversionTracker";
import type { MetaConversionsClient } from "../../../infrastructure/meta/MetaConversionsClient";
import { SecretDecryptionError } from "../../../platform/security/secrets/SecretCipher";

// ---------------------------------------------------------------------------
// Adaptador del puerto `ConversionTracker`: descifra el token del píxel (solo
// en su cuenta) y envía el evento a Meta. El token vive en memoria lo que
// dura la llamada; no se devuelve ni se registra.
// ---------------------------------------------------------------------------

export class VaultConversionTracker implements ConversionTracker {
  public constructor(
    private readonly vault: PixelConnectionVault,
    private readonly meta: MetaConversionsClient
  ) {}

  public async track(tenantId: string, request: TrackConversionRequest): Promise<TrackConversionResult> {
    let connection;
    try {
      connection = await this.vault.reveal(tenantId, request.connectionId);
    } catch (error) {
      if (error instanceof SecretDecryptionError) {
        return { ok: false, reason: "invalid_token", message: "No se pudo leer el token del píxel; vuelve a guardarlo." };
      }
      throw error;
    }
    if (!connection) return { ok: false, reason: "connection_not_found", message: "El píxel del bloque ya no existe; elige otro." };

    return this.meta.send(connection.pixelId, connection.accessToken, request.event, request.testEventCode);
  }
}
