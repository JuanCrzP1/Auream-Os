import { randomUUID } from "node:crypto";
import type { RequestContext } from "../contracts/RequestContext";
import type { TokenVerifier } from "./TokenVerifier";
import type { ApiKeyVerifier } from "./ApiKeyVerifier";

// ---------------------------------------------------------------------------
// AuthService
//
// Orquesta la verificación de credenciales y construye el RequestContext.
// Cada request autenticada recibe un requestId único para trazabilidad.
// ---------------------------------------------------------------------------

export class AuthService {
  public constructor(
    private readonly jwtVerifier: TokenVerifier,
    private readonly apiKeyVerifier: ApiKeyVerifier
  ) {}

  public async authenticateBearer(token: string): Promise<RequestContext> {
    const identity = await this.jwtVerifier.verify(token);

    return {
      tenantId: identity.tenantId,
      actorId: identity.actorId,
      authMethod: "jwt",
      requestId: randomUUID(),
      scopes: identity.scopes
    };
  }

  public async authenticateApiKey(rawKey: string): Promise<RequestContext> {
    const identity = await this.apiKeyVerifier.verify(rawKey);

    return {
      tenantId: identity.tenantId,
      actorId: identity.actorId,
      authMethod: "api_key",
      requestId: randomUUID(),
      scopes: identity.scopes
    };
  }
}
