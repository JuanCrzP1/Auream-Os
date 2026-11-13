import { describe, expect, it } from "vitest";
import { NOT_CONFIRMED } from "../../domains/conversations/domain/ScheduledMessage.js";
import { PermanentTaskError, type ScheduledTask } from "../../domains/scheduling/domain/ScheduledTask.js";
import { SchedulerScheduledMessageAlarm, ScheduledMessageTaskHandler } from "../../apps/api/composition/scheduledMessageTaskAdapters.js";
import type { SendResult } from "../../domains/conversations/application/ports/ConversationPorts.js";
import { AUTHOR, CHAT, TEXT, scheduledHarness } from "../helpers/scheduledMessagesFakes.js";

// ---------------------------------------------------------------------------
// A la hora: sale a nombre de quien lo programó (sin tomar el chat ni pausar
// el bot), una sola vez; «si el cliente responde antes» se revisa al enviar;
// lo que no sale queda a la vista con su motivo y nunca se duplica.
// ---------------------------------------------------------------------------

const TOMORROW_9 = { date: "2026-11-13", time: "09:00" };
const AT_9 = new Date("2026-11-13T14:00:00.000Z");

/** Programa uno para mañana a las 9 y devuelve SU id (puede haber otros a la misma hora). */
async function scheduled(h: ReturnType<typeof scheduledHarness>, extra: Record<string, unknown> = {}) {
  const before = new Set(h.repository.rows.keys());
  await h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9, ...extra }, AUTHOR);
  return [...h.repository.rows.keys()].find((id) => !before.has(id))!;
}

describe("enviar un mensaje programado", () => {
  it("a su hora sale una sola vez, a nombre de su autor, y queda en el hilo", async () => {
    const h = scheduledHarness();
    const id = await scheduled(h);
    h.clock.at = AT_9;
    await h.dispatcher.fire("t1", id);
    await h.dispatcher.fire("t1", id);
    expect(h.sent).toEqual([{ phone: "573001112233", count: 1 }]);
    expect(h.recorded).toHaveLength(1);
    expect(h.recorded[0]!.agentId).toBe(AUTHOR);
    expect(h.repository.rows.get(id)!.status).toBe("sent");
    expect((await h.service.list("t1", CHAT)).messages).toEqual([]);
  });

  it("si lo reprogramaron más tarde, la tarea vieja no hace nada; si lo cancelaron, tampoco", async () => {
    const h = scheduledHarness();
    const id = await scheduled(h);
    await h.service.update("t1", CHAT, id, { date: "2026-11-13", time: "11:00" });
    h.clock.at = AT_9;
    await h.dispatcher.fire("t1", id);
    expect(h.sent).toHaveLength(0);
    await h.service.cancel("t1", CHAT, id);
    h.clock.at = new Date("2026-11-13T16:00:00.000Z");
    await h.dispatcher.fire("t1", id);
    expect(h.sent).toHaveLength(0);
  });

  it("«no enviar si el cliente responde antes»: omitido si escribió después de programarlo; «Enviar igual» lo manda", async () => {
    const h = scheduledHarness();
    const id = await scheduled(h);
    h.repository.lastInbound = "2026-11-12T22:00:00.000Z";
    h.clock.at = AT_9;
    await h.dispatcher.fire("t1", id);
    expect(h.sent).toHaveLength(0);
    expect((await h.service.list("t1", CHAT)).messages[0]).toMatchObject({ status: "skipped", error: "El cliente respondió antes." });
    await h.service.sendNow("t1", CHAT, id);
    expect(h.sent).toHaveLength(1);
  });

  it("lo que el cliente escribió ANTES de programarlo no cuenta; si escribe después, solo sale el que no tiene el aviso", async () => {
    const h = scheduledHarness();
    h.repository.lastInbound = "2026-11-12T19:00:00.000Z";
    const first = await scheduled(h);
    const second = await scheduled(h, { cancelIfReplied: false });
    h.repository.lastInbound = "2026-11-12T23:00:00.000Z";
    h.clock.at = AT_9;
    await h.dispatcher.fire("t1", first);
    await h.dispatcher.fire("t1", second);
    expect(h.repository.rows.get(first)!.status).toBe("skipped");
    expect(h.repository.rows.get(second)!.status).toBe("sent");
  });

  it("número desconectado: queda fallido con el motivo, sin ensuciar el hilo; «Reintentar» avisa si vuelve a fallar", async () => {
    const h = scheduledHarness();
    h.sender.deliver = async (_t, _c, _p, messages) => ({ results: messages.map((message) => ({ message, ok: false, error: "El número no tiene una sesión activa para enviar." })) as unknown as SendResult[] });
    const id = await scheduled(h);
    h.clock.at = AT_9;
    await h.dispatcher.fire("t1", id);
    expect(h.recorded).toHaveLength(0);
    expect((await h.service.list("t1", CHAT)).messages[0]).toMatchObject({ status: "failed", error: "El número no tiene una sesión activa para enviar." });
    await expect(h.service.sendNow("t1", CHAT, id)).rejects.toThrow("No se pudo enviar: El número no tiene una sesión activa");
  });

  it("si se corta DURANTE el envío queda fallido «revisa el chat» (nunca se reenvía solo); si se corta ANTES, la cola lo reintenta", async () => {
    const h = scheduledHarness();
    h.sender.deliver = async () => {
      throw new Error("se cayó la red");
    };
    const id = await scheduled(h);
    h.clock.at = AT_9;
    await h.dispatcher.fire("t1", id);
    expect(h.repository.rows.get(id)).toMatchObject({ status: "failed", error: NOT_CONFIRMED });

    const before = scheduledHarness();
    const other = await scheduled(before);
    before.repository.lastInboundAt = async () => {
      throw new Error("sin base");
    };
    before.clock.at = AT_9;
    await expect(before.dispatcher.fire("t1", other)).rejects.toThrow("sin base");
    expect(before.repository.rows.get(other)!.status).toBe("pending");
    expect(before.sent).toHaveLength(0);
  });

  it("uno «saliendo» hace rato se marca fallido; uno que está saliendo ahora se revisa luego", async () => {
    const h = scheduledHarness();
    const id = await scheduled(h);
    await h.repository.claim("t1", id, ["pending"], AT_9);
    h.clock.at = new Date(AT_9.getTime() + 30_000);
    await expect(h.dispatcher.fire("t1", id)).rejects.toThrow("se está enviando");
    await expect(h.service.cancel("t1", CHAT, id)).rejects.toThrow("se está enviando");
    h.clock.at = new Date(AT_9.getTime() + 180_000);
    await h.dispatcher.fire("t1", id);
    expect(h.repository.rows.get(id)).toMatchObject({ status: "failed", error: NOT_CONFIRMED });
    expect(h.sent).toHaveLength(0);
  });
});

describe("la cola de tareas", () => {
  it("una tarea por mensaje y hora (reprogramar arma otra) y el manejador rechaza tareas sin mensaje", async () => {
    const tasks: unknown[] = [];
    await new SchedulerScheduledMessageAlarm({ schedule: async (task: unknown) => tasks.push(task) } as never).arm("t1", CHAT, "s1", AT_9);
    expect(tasks[0]).toMatchObject({ kind: "chat.scheduled_message", groupKey: `chat-scheduled:${CHAT}`, dedupeKey: `chat.scheduled_message:s1:${AT_9.getTime()}`, payload: { scheduledId: "s1" }, dueAt: AT_9 });
    const fired: string[] = [];
    const handler = new ScheduledMessageTaskHandler({ fire: async (_tenantId, id) => void fired.push(id) });
    await handler.handle({ tenantId: "t1", payload: { scheduledId: "s1" } } as unknown as ScheduledTask);
    expect(fired).toEqual(["s1"]);
    await expect(handler.handle({ tenantId: "t1", payload: {} } as unknown as ScheduledTask)).rejects.toBeInstanceOf(PermanentTaskError);
  });
});
