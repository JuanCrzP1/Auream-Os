import { createHash } from "node:crypto";
import type { AuthIdentity } from "../contracts/AuthIdentity";
import type { ApiKeyRegistry } from "./ApiKeyRegistry";

// ---------------------------------------------------------------------------
// ApiKeyVerifier
//
// Verifica API keys con el formato "bfk_<hex>".
//
// Seguridad:
// - Las API keys se almacenan hasheadas con SHA-256 (nunca en texto plano).
// - El lookup usa el hash para comparar, evitando exposición del secreto.
// - El prefijo "bfk_" es un guard temprano que falla rápido en inputs inválidos
//   sin revelar si la clave existe o no.
// ---------------------------------------------------------------------------

const API_KEY_PREFIX = "bfk_";

export class ApiKeyVerifier {
  public constructor(private readonly registry: ApiKeyRegistry) {}

  public async verify(rawKey: string): Promise<AuthIdentity> {
    if (!rawKey.startsWith(API_KEY_PREFIX)) {
      throw new Error("Invalid API key format");
    }

    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const identity = this.registry.findByHash(keyHash);

    if (!identity) {
      throw new Error("API key not found or revoked");
    }

    return identity;
  }
}
