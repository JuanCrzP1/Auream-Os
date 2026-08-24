import { createPublicKey, type KeyObject } from "node:crypto";
import type { JwksKeyStore } from "../../platform/identity/application/JwksKeyStore";

// ---------------------------------------------------------------------------
// HttpJwksKeyStore
//
// Responsabilidad única: obtener y cachear las claves públicas del JWKS.
//
// Soporta rotación: si llega un `kid` desconocido, refresca una vez. El
// refresco está acotado por `minRefreshIntervalMs` para que un atacante no
// pueda forzar descargas ilimitadas enviando kids inventados.
// ---------------------------------------------------------------------------

interface JwkEntry {
  readonly kid?: string;
  readonly alg?: string;
  readonly kty?: string;
  readonly crv?: string;
  readonly x?: string;
}

const DEFAULT_MIN_REFRESH_INTERVAL_MS = 60_000;

export class HttpJwksKeyStore implements JwksKeyStore {
  private readonly keys = new Map<string, KeyObject>();
  private lastRefreshAt = 0;

  public constructor(
    private readonly jwksUrl: string,
    private readonly minRefreshIntervalMs: number = DEFAULT_MIN_REFRESH_INTERVAL_MS
  ) {}

  public async findKey(kid: string): Promise<KeyObject | null> {
    const cached = this.keys.get(kid);

    if (cached) {
      return cached;
    }

    if (!this.canRefresh()) {
      return null;
    }

    await this.refresh();
    return this.keys.get(kid) ?? null;
  }

  private canRefresh(): boolean {
    return Date.now() - this.lastRefreshAt >= this.minRefreshIntervalMs;
  }

  private async refresh(): Promise<void> {
    this.lastRefreshAt = Date.now();

    const response = await fetch(this.jwksUrl);

    if (!response.ok) {
      throw new Error(`No se pudo obtener el JWKS (HTTP ${response.status})`);
    }

    const body = (await response.json()) as { keys?: JwkEntry[] };

    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
        continue;
      }

      this.keys.set(jwk.kid, createPublicKey({ key: jwk as never, format: "jwk" }));
    }
  }
}
