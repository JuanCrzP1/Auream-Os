import { verify as verifySignature } from "node:crypto";
import type { NeonAuthClaims } from "../contracts/NeonAuthClaims";
import type { UserIdentity } from "../contracts/UserIdentity";
import type { JwksKeyStore } from "./JwksKeyStore";
import type { TokenVerifier } from "./TokenVerifier";

// ---------------------------------------------------------------------------
// JwksTokenVerifier
//
// Responsabilidad única: decidir si un JWT de Neon Auth es auténtico y de ESTE
// entorno, y extraer de él la identidad del usuario.
//
// NO resuelve tenant, membership, rol ni scopes: eso ocurre después, contra
// nuestra base de datos. El token sólo dice quién eres.
//
// Seguridad — por qué `iss`/`aud` son obligatorios:
// las ramas de Neon heredan la MISMA clave JWKS del padre, así que la firma NO
// distingue producción de test. Sin validar el emisor, un token emitido en test
// sería criptográficamente válido en producción. Verificado empíricamente.
// ---------------------------------------------------------------------------

const ALLOWED_ALGORITHM = "EdDSA";
/** Tolerancia de reloj para `iat`, en segundos. */
const CLOCK_SKEW_SECONDS = 5;

export class TokenVerificationError extends Error {}

interface JwtHeader {
  readonly alg?: string;
  readonly kid?: string;
}

function decodeSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString()) as T;
  } catch {
    throw new TokenVerificationError("Token ilegible");
  }
}

export interface JwksTokenVerifierOptions {
  readonly keyStore: JwksKeyStore;
  readonly expectedIssuer: string;
  readonly expectedAudience: string;
}

export class JwksTokenVerifier implements TokenVerifier {
  public constructor(private readonly options: JwksTokenVerifierOptions) {}

  public async verify(token: string): Promise<UserIdentity> {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new TokenVerificationError("Estructura de token inválida");
    }

    const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];
    const header = decodeSegment<JwtHeader>(headerSegment);

    if (header.alg !== ALLOWED_ALGORITHM) {
      throw new TokenVerificationError("Algoritmo no permitido");
    }

    if (!header.kid) {
      throw new TokenVerificationError("Token sin kid");
    }

    const key = await this.options.keyStore.findKey(header.kid);

    if (!key) {
      throw new TokenVerificationError("Clave de firma desconocida");
    }

    const signatureValid = verifySignature(
      null,
      Buffer.from(`${headerSegment}.${payloadSegment}`),
      key,
      Buffer.from(signatureSegment, "base64url")
    );

    if (!signatureValid) {
      throw new TokenVerificationError("Firma inválida");
    }

    const claims = decodeSegment<NeonAuthClaims>(payloadSegment);
    this.validateClaims(claims);

    // Sólo la identidad. Nunca tenant, nunca scopes.
    return { actorId: claims.sub };
  }

  private validateClaims(claims: NeonAuthClaims): void {
    if (typeof claims.sub !== "string" || claims.sub.length === 0) {
      throw new TokenVerificationError("Token sin sujeto");
    }

    const now = Math.floor(Date.now() / 1000);

    if (typeof claims.exp !== "number" || claims.exp <= now) {
      throw new TokenVerificationError("Token expirado");
    }

    if (typeof claims.iat !== "number" || claims.iat > now + CLOCK_SKEW_SECONDS) {
      throw new TokenVerificationError("Token emitido en el futuro");
    }

    // Barrera anti cross-branch: la clave es compartida, el emisor no.
    if (claims.iss !== this.options.expectedIssuer) {
      throw new TokenVerificationError("Emisor no reconocido");
    }

    if (claims.aud !== this.options.expectedAudience) {
      throw new TokenVerificationError("Audiencia no reconocida");
    }
  }
}
