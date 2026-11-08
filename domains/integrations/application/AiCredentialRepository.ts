import type { AiCredential } from "../domain/AiCredential";

export interface AiCredentialRepository {
  listByTenant(tenantId: string): Promise<AiCredential[]>;
  findById(tenantId: string, id: string): Promise<AiCredential | null>;
  /** Inserta o actualiza. Un nombre repetido en la cuenta → `ConflictError`. */
  save(credential: AiCredential): Promise<void>;
  /** `true` si existía. */
  delete(tenantId: string, id: string): Promise<boolean>;
}
