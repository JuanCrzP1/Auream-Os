import { createHash } from "node:crypto";
import type { ApiKeyRegistry } from "../../../platform/identity/application/ApiKeyRegistry";
import type { AuthIdentity } from "../../../platform/identity/contracts/AuthIdentity";

// ---------------------------------------------------------------------------
// InMemoryApiKeyRegistry
//
// Registro en memoria de API keys hasheadas.
// Las claves se almacenan como SHA-256 hex del rawKey — nunca en texto plano.
//
// register(rawKey, identity) → hashea y almacena
// findByHash(keyHash)        → lookup por hash
//
// En producción: reemplazar con PostgresApiKeyRegistry.
// ---------------------------------------------------------------------------

export class InMemoryApiKeyRegistry implements ApiKeyRegistry {
  private readonly keys = new Map<string, AuthIdentity>();

  public register(rawKey: string, identity: AuthIdentity): void {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    this.keys.set(keyHash, identity);
  }

  public findByHash(keyHash: string): AuthIdentity | undefined {
    return this.keys.get(keyHash);
  }
}
