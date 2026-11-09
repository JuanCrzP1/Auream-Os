import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { ConnectionRepository } from "./ConnectionRepository";
import { applyState, sessionOf } from "./connectionSession";
import type { WhatsAppLinkers } from "./ports/WhatsAppLinker";

// ---------------------------------------------------------------------------
// ¿Siguen vivos los números «conectados»? Se le pregunta al proveedor al abrir
// Conexiones. Hace falta porque el proveedor no siempre avisa: si borra una
// sesión (el servidor gratuito de uazapi lo hace solo) no llega ningún aviso
// y el número se vería «Conectado» para siempre, sin opción de escanear.
//
// Barato y seguro: como mucho una revisión por minuto por cuenta (límite
// compartido en Neon) y hasta 10 números en paralelo. Si el proveedor falla
// con uno, ese se deja como está (se revisa la próxima vez).
// ---------------------------------------------------------------------------

export const VERIFY_POLICY = { windowMs: 60_000, maxRequests: 1 } as const;
const MAX_CHECKED = 10;

export interface VerifyConnectionsDependencies {
  readonly repository: ConnectionRepository;
  readonly linkers: WhatsAppLinkers;
  readonly cipher: SecretCipher;
  /** Límite de revisiones por cuenta. Ausente: sin límite (pruebas). */
  readonly limiter?: RateLimiter;
  readonly now?: () => Date;
}

export interface VerifyConnectionsResult {
  /** `false` si se revisó hace menos de un minuto (no se preguntó nada). */
  readonly verified: boolean;
  /** Cuántos números cambiaron de estado o de perfil. */
  readonly changed: number;
}

export class VerifyConnectionsService {
  public constructor(private readonly deps: VerifyConnectionsDependencies) {}

  public async execute(tenantId: string): Promise<VerifyConnectionsResult> {
    if (this.deps.limiter && !(await this.deps.limiter.check(`connections:verify:${tenantId}`, VERIFY_POLICY)).allowed) return { verified: false, changed: 0 };

    const connected = (await this.deps.repository.listByTenant(tenantId)).filter((connection) => connection.status === "connected").slice(0, MAX_CHECKED);
    const at = (this.deps.now ?? (() => new Date()))().toISOString();
    const results = await Promise.allSettled(
      connected.map(async (connection) => {
        const session = sessionOf(connection, this.deps.cipher);
        if (!session) return false;
        const state = await this.deps.linkers.for(connection.method).check(session);
        const updated = applyState(connection, state, at);
        const changed = updated.status !== connection.status || updated.profileName !== connection.profileName || updated.profilePictureUrl !== connection.profilePictureUrl;
        if (changed) await this.deps.repository.save(updated);
        return changed;
      })
    );
    return { verified: true, changed: results.filter((result) => result.status === "fulfilled" && result.value).length };
  }
}
