import type { TaskRepository } from "../../../domains/scheduling/application/TaskRepository";
import { CHAIN_TASK_KIND, DEFAULT_MAX_ATTEMPTS, type NewTask, type ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";

/** Cola en memoria (tests y servidor local sin base). Mismas reglas que la versión SQL. */
export class InMemoryTaskRepository implements TaskRepository {
  public readonly tasks = new Map<string, ScheduledTask>();

  public async enqueue(id: string, task: NewTask): Promise<boolean> {
    if ([...this.tasks.values()].some((existing) => existing.dedupeKey === task.dedupeKey)) return false;
    this.tasks.set(id, {
      id,
      tenantId: task.tenantId,
      kind: task.kind,
      groupKey: task.groupKey,
      dedupeKey: task.dedupeKey,
      payload: task.payload,
      status: "pending",
      dueAt: task.dueAt.toISOString(),
      attempts: 0,
      maxAttempts: task.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      lockedUntil: null,
      lastError: null,
      createdAt: new Date().toISOString(),
      finishedAt: null
    });
    return true;
  }

  public async cancelGroup(tenantId: string, groupKey: string, except?: string): Promise<number> {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.tenantId === tenantId && task.groupKey === groupKey && task.status === "pending" && task.dedupeKey !== except) {
        this.tasks.set(task.id, { ...task, status: "cancelled", finishedAt: new Date().toISOString() });
        count += 1;
      }
    }
    return count;
  }

  public async claimDue(now: Date, limit: number, leaseMs: number): Promise<ScheduledTask[]> {
    const due = [...this.tasks.values()]
      .filter((task) => (task.status === "pending" && task.dueAt <= now.toISOString()) || (task.status === "running" && task.lockedUntil !== null && task.lockedUntil < now.toISOString()))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, limit);
    return due.map((task) => {
      const claimed: ScheduledTask = { ...task, status: "running", attempts: task.attempts + 1, lockedUntil: new Date(now.getTime() + leaseMs).toISOString() };
      this.tasks.set(task.id, claimed);
      return claimed;
    });
  }

  public async complete(id: string, now: Date): Promise<void> {
    this.update(id, { status: "done", finishedAt: now.toISOString(), lockedUntil: null, lastError: null });
  }

  public async retry(id: string, error: string, nextDueAt: Date): Promise<void> {
    this.update(id, { status: "pending", dueAt: nextDueAt.toISOString(), lastError: error, lockedUntil: null });
  }

  public async fail(id: string, error: string, now: Date): Promise<void> {
    this.update(id, { status: "failed", lastError: error, finishedAt: now.toISOString(), lockedUntil: null });
  }

  public async peekNext(): Promise<{ dueAt: Date; tenantId: string } | null> {
    const next = [...this.tasks.values()].filter((task) => task.status === "pending" && task.kind !== CHAIN_TASK_KIND).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    return next ? { dueAt: new Date(next.dueAt), tenantId: next.tenantId } : null;
  }

  public async purgeFinished(before: Date, limit: number): Promise<number> {
    const old = [...this.tasks.values()].filter((task) => task.finishedAt !== null && task.finishedAt < before.toISOString()).slice(0, limit);
    old.forEach((task) => this.tasks.delete(task.id));
    return old.length;
  }

  private update(id: string, patch: Partial<ScheduledTask>): void {
    const task = this.tasks.get(id);
    if (task && task.status === "running") this.tasks.set(id, { ...task, ...patch });
  }
}
