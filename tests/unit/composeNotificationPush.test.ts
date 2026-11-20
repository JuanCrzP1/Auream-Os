import { describe, expect, it, vi } from "vitest";
import { composeNotificationPush, FOLLOW_UP_PUSH_TASK } from "../../apps/api/composition/composeNotificationPush.js";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import type { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import type { FollowUp } from "../../domains/crm/domain/FollowUp.js";

// ---------------------------------------------------------------------------
// Los ganchos de los avisos: el recordatorio de un seguimiento va a la cola a
// su hora (uno por seguimiento: moverlo reemplaza el anterior); uno ya hecho,
// sin responsable o de una hora pasada no; sin claves, nada (ni se consulta la
// base). Y los avisos salen en segundo plano.
// ---------------------------------------------------------------------------

const KEYS = { publicKey: "B".repeat(87), privateKey: "c".repeat(43), subject: "https://auream.app" };
const untouchable = { query: vi.fn(async () => { throw new Error("no debía consultar la base"); }) } as unknown as SqlClient;
const followUp = (over: Partial<FollowUp> = {}): FollowUp => ({
  id: "f1", tenantId: "t1", contactId: "c1", title: "Llamar", dueAt: new Date(Date.now() + 3_600_000).toISOString(), assigneeId: "u1", createdBy: "u1", doneAt: null, doneBy: null, ...over
});

function setup(keys: typeof KEYS | null = KEYS) {
  const replaceInGroup = vi.fn(async () => true);
  const run = vi.fn();
  const push = composeNotificationPush({ sql: untouchable, keys, background: { run }, scheduler: { replaceInGroup } as unknown as TaskScheduler, onError: vi.fn() });
  return { push, replaceInGroup, run };
}

describe("ganchos de los avisos al celular", () => {
  it("un seguimiento con responsable y hora futura: su recordatorio en la cola, uno por seguimiento", async () => {
    const { push, replaceInGroup } = setup();
    const item = followUp();
    await push.followUpScheduled(item);
    expect(replaceInGroup).toHaveBeenCalledWith({
      tenantId: "t1", kind: FOLLOW_UP_PUSH_TASK, groupKey: "push-follow-up:f1", dedupeKey: `push-follow-up:f1:${item.dueAt}`,
      payload: { followUpId: "f1", dueAt: item.dueAt }, dueAt: new Date(item.dueAt), maxAttempts: 2
    });
    expect(push.handler.kind).toBe(FOLLOW_UP_PUSH_TASK);
  });

  it("hecho, sin responsable o de una hora que ya pasó: no se programa", async () => {
    const { push, replaceInGroup } = setup();
    await push.followUpScheduled(followUp({ doneAt: new Date().toISOString() }));
    await push.followUpScheduled(followUp({ assigneeId: null }));
    await push.followUpScheduled(followUp({ dueAt: new Date(Date.now() - 60_000).toISOString() }));
    expect(replaceInGroup).not.toHaveBeenCalled();
  });

  it("los avisos salen en segundo plano; sin claves no se manda ni se programa nada", async () => {
    const on = setup();
    await on.push.numberDropped({ id: "c1", tenantId: "t1" } as never);
    await on.push.inbound.heard("t1", { phone: "573001112233", text: "Hola", connectionId: "c1", kind: "text" });
    expect(on.run).toHaveBeenCalledTimes(2);

    const off = setup(null);
    await off.push.numberDropped({ id: "c1", tenantId: "t1" } as never);
    await off.push.saleNeedsReview("t1", { id: "s1", customerName: null, amount: 1, currency: "COP", reviewReason: null, recordedBy: null });
    await off.push.followUpScheduled(followUp());
    expect([off.run.mock.calls.length, off.replaceInGroup.mock.calls.length]).toEqual([0, 0]);
    expect(untouchable.query).not.toHaveBeenCalled();
  });
});
