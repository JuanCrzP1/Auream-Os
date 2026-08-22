import type { AuthIdentity } from "../contracts/AuthIdentity";

export interface ApiKeyRegistry {
  findByHash(keyHash: string): AuthIdentity | undefined;
}
