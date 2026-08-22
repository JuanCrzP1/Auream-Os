import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthIdentity } from "../contracts/AuthIdentity";
import type { TokenVerifier } from "./TokenVerifier";

// ---------------------------------------------------------------------------
// JwtTokenVerifier
//
// Verifica tokens JWT firmados con HMAC-SHA256 (HS256).
//
// Seguridad:
// - La comparación de firma usa timingSafeEqual para evitar timing attacks.
// - El secreto debe tener al menos 32 caracteres.
// - Claims validados: exp (expiración), iat (no en futuro), sub, tenant, scopes.
//
// Claims esperados en el payload:
//   sub     → actorId (quién hace la request)
//   tenant  → tenantId (a qué tenant pertenece)
//   scopes  → array de permisos concedidos
//   iat     → issued at (segundos Unix)
//   exp     → expiration (segundos Unix)
// ---------------------------------------------------------------------------

interface JwtPayload {
  readonly sub: string;
  readonly tenant: string;
  readonly scopes: ReadonlyArray<string>;
  readonly exp: number;
  readonly iat: number;
}

export class JwtTokenVerifier implements TokenVerifier {
  public constructor(private readonly secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error("JWT secret must be at least 32 characters");
    }
  }

  public async verify(token: string): Promise<AuthIdentity> {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new Error("Invalid JWT structure");
    }

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    this.verifySignature(headerB64, payloadB64, signatureB64);

    const payload = this.decodePayload(payloadB64);
    this.validateClaims(payload);

    return {
      tenantId: payload.tenant,
      actorId: payload.sub,
      scopes: Array.isArray(payload.scopes) ? payload.scopes : []
    };
  }

  private verifySignature(headerB64: string, payloadB64: string, signatureB64: string): void {
    const expected = createHmac("sha256", this.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();

    const actual = Buffer.from(
      signatureB64.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error("Invalid JWT signature");
    }
  }

  private decodePayload(payloadB64: string): JwtPayload {
    try {
      const json = Buffer.from(
        payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8");

      return JSON.parse(json) as JwtPayload;
    } catch {
      throw new Error("Invalid JWT payload");
    }
  }

  private validateClaims(payload: JwtPayload): void {
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new Error("JWT missing subject claim");
    }

    if (!payload.tenant || typeof payload.tenant !== "string") {
      throw new Error("JWT missing tenant claim");
    }

    if (typeof payload.exp !== "number" || payload.exp <= now) {
      throw new Error("JWT expired or missing exp claim");
    }

    if (typeof payload.iat !== "number" || payload.iat > now + 60) {
      throw new Error("JWT iat claim is in the future");
    }

    if (!Array.isArray(payload.scopes)) {
      throw new Error("JWT missing scopes claim");
    }
  }
}
