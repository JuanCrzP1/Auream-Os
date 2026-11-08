import type { PixelConnection } from "../domain/PixelConnection";

export interface PixelConnectionRepository {
  listByTenant(tenantId: string): Promise<PixelConnection[]>;
  findById(tenantId: string, id: string): Promise<PixelConnection | null>;
  /** Inserta o actualiza. Un nombre repetido en la cuenta → `ConflictError`. */
  save(connection: PixelConnection): Promise<void>;
  /** `true` si existía. */
  delete(tenantId: string, id: string): Promise<boolean>;
}
