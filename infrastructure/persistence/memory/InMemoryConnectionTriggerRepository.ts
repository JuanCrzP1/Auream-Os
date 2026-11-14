import type { ConnectionTriggerRepository } from "../../../domains/connections/application/ConnectionTriggerRepository";
import type { ConnectionTriggerRecord } from "../../../domains/connections/domain/ConnectionTriggerRecord";
import type { FlowCatalog, FlowReference } from "../../../domains/connections/application/ports/FlowCatalog";

/** Disparadores en memoria (tests). */
export class InMemoryConnectionTriggerRepository implements ConnectionTriggerRepository {
  private items: ConnectionTriggerRecord[] = [];

  public async listByConnection(tenantId: string, connectionId: string): Promise<ConnectionTriggerRecord[]> {
    return this.items
      .filter((item) => item.tenantId === tenantId && item.connectionId === connectionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  public async findById(tenantId: string, id: string): Promise<ConnectionTriggerRecord | null> {
    return this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null;
  }

  public async countByConnection(tenantId: string): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const item of this.items) if (item.tenantId === tenantId) counts.set(item.connectionId, (counts.get(item.connectionId) ?? 0) + 1);
    return counts;
  }

  public async save(trigger: ConnectionTriggerRecord): Promise<void> {
    const index = this.items.findIndex((item) => item.id === trigger.id && item.tenantId === trigger.tenantId);
    if (index >= 0) this.items[index] = trigger;
    else this.items.push(trigger);
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((item) => !(item.tenantId === tenantId && item.id === id));
    return this.items.length < before;
  }
}

/** Catálogo de flujos fijo (tests). */
export class InMemoryFlowCatalog implements FlowCatalog {
  public constructor(private readonly flows: ReadonlyArray<Omit<FlowReference, "key"> & { readonly key?: string; readonly tenantId: string }> = []) {}

  public async findMany(tenantId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FlowReference>> {
    return this.flows
      .filter((flow) => flow.tenantId === tenantId && ids.includes(flow.id))
      .map(({ id, key, name, archived, paused }) => ({ id, key: key ?? id, name, archived, ...(paused ? { paused } : {}) }));
  }
}
