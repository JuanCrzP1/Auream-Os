import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import type { WhatsAppConnection } from "../domain/WhatsAppConnection";
import { sessionOf } from "./ConnectionServices";
import type { WhatsAppLinkers } from "./ports/WhatsAppLinker";

// ---------------------------------------------------------------------------
// ProviderWebhookKeeper — mantiene al día la configuración de avisos de cada
// número en su proveedor (qué eventos manda: mensajes, entregado/leído…).
//
// Cuando una versión nueva necesita otro evento, nadie tiene que tocar «Ver
// estado»: el primer aviso que llega de ese número la pone al día (una vez
// por proceso y cada `refreshEveryMs`, para sanar también cambios hechos a
// mano en el panel del proveedor). Nunca lanza: si falla, se reintenta luego.
// ---------------------------------------------------------------------------

export class ProviderWebhookKeeper {
  private readonly refreshedAt = new Map<string, number>();

  public constructor(
    private readonly linkers: WhatsAppLinkers,
    private readonly cipher: SecretCipher,
    private readonly refreshEveryMs = 6 * 3_600_000,
    private readonly now: () => number = () => Date.now()
  ) {}

  public async ensureCurrent(connection: WhatsAppConnection): Promise<void> {
    const last = this.refreshedAt.get(connection.id);
    if (last !== undefined && this.now() - last < this.refreshEveryMs) return;
    this.refreshedAt.set(connection.id, this.now());
    try {
      const session = sessionOf(connection, this.cipher);
      if (session && connection.status === "connected") await this.linkers.for(connection.method).refresh(session);
    } catch {
      // Se reintenta con el próximo aviso.
      this.refreshedAt.delete(connection.id);
    }
  }
}
