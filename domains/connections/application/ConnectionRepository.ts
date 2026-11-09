import type { WhatsAppConnection } from "../domain/WhatsAppConnection";

export interface ConnectionRepository {
  listByTenant(tenantId: string): Promise<WhatsAppConnection[]>;
  findById(tenantId: string, id: string): Promise<WhatsAppConnection | null>;
  /** Inserta o actualiza. Un nombre repetido en la cuenta → `ConflictError`. */
  save(connection: WhatsAppConnection): Promise<void>;
  /** `true` si existía. */
  delete(tenantId: string, id: string): Promise<boolean>;
}
