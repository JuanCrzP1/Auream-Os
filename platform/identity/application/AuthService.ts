import type { AuthIdentity } from "../contracts/AuthIdentity";
import type { UserIdentity } from "../contracts/UserIdentity";
import type { TokenVerifier } from "./TokenVerifier";
import type { ApiKeyVerifier } from "./ApiKeyVerifier";

// ---------------------------------------------------------------------------
// AuthService
//
// Responsabilidad única: verificar credenciales y devolver quién las presenta.
//
// Devuelve dos formas distintas a propósito:
//
//   Bearer  → UserIdentity   sólo el usuario; tenant y scopes se resuelven
//                            después contra la base de datos.
//   API key → AuthIdentity   la clave ya está emitida para un tenant y unos
//                            scopes concretos (uso máquina a máquina).
//
// No construye el RequestContext: eso es responsabilidad del middleware, que
// además conoce la petición (requestId, tenant seleccionado).
// ---------------------------------------------------------------------------

export class AuthService {
  public constructor(
    private readonly tokenVerifier: TokenVerifier,
    private readonly apiKeyVerifier: ApiKeyVerifier
  ) {}

  public async authenticateBearer(token: string): Promise<UserIdentity> {
    return this.tokenVerifier.verify(token);
  }

  public async authenticateApiKey(rawKey: string): Promise<AuthIdentity> {
    return this.apiKeyVerifier.verify(rawKey);
  }
}
