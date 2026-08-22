import type { AuthIdentity } from "../contracts/AuthIdentity";

export interface TokenVerifier {
  verify(token: string): Promise<AuthIdentity>;
}
