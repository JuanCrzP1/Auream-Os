import type { ConnectionTriggerRecord } from "../domain/ConnectionTriggerRecord";

export interface ConnectionTriggerRepository {
  /** Los disparadores de una conexión, del más antiguo al más nuevo. */
  listByConnection(tenantId: string, connectionId: string): Promise<ConnectionTriggerRecord[]>;
  findById(tenantId: string, id: string): Promise<ConnectionTriggerRecord | null>;
  /** Cuántos disparadores tiene cada conexión de la cuenta (las que no tienen, no vienen). */
  countByConnection(tenantId: string): Promise<ReadonlyMap<string, number>>;
  save(trigger: ConnectionTriggerRecord): Promise<void>;
  /** `true` si existía. */
  delete(tenantId: string, id: string): Promise<boolean>;
}
