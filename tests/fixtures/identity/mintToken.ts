import { sign } from "node:crypto";
import { base64url, SHARED_KID, signingKey } from "./jwksFixtures.js";

/**
 * Emite un JWT EdDSA con la misma forma que produce Neon Auth.
 *
 * Existe sólo para tests: permite construir tokens de cada "rama" y comprobar
 * que el verificador los distingue por emisor pese a compartir la clave.
 */
export interface MintOptions {
  readonly sub?: string;
  readonly iss: string;
  readonly aud?: string;
  readonly expiresInSeconds?: number;
  readonly issuedAtOffsetSeconds?: number;
  readonly alg?: string;
  readonly kid?: string;
  /** Claims extra — se usan para comprobar que el verificador los IGNORA. */
  readonly extraClaims?: Record<string, unknown>;
}

export function mintToken(options: MintOptions): string {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(
    JSON.stringify({ alg: options.alg ?? "EdDSA", kid: options.kid ?? SHARED_KID })
  );

  const payload = base64url(
    JSON.stringify({
      sub: options.sub ?? "user-fixture",
      iss: options.iss,
      aud: options.aud ?? options.iss,
      iat: now + (options.issuedAtOffsetSeconds ?? 0),
      exp: now + (options.expiresInSeconds ?? 900),
      ...options.extraClaims
    })
  );

  const signature = sign(null, Buffer.from(`${header}.${payload}`), signingKey());

  return `${header}.${payload}.${signature.toString("base64url")}`;
}
