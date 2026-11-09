import { describe, expect, it } from "vitest";
import { resolveResumeAt } from "../../flow-engine/scheduling/resolveResumeAt.js";
import { readIntervalConfig, EMPTY_SCHEDULE, type IntervalConfig } from "../../contracts/IntervalConfig.js";
import { DelayNodeHandler } from "../../flow-engine/nodes/delay/DelayNodeHandler.js";
import { QuestionNodeHandler } from "../../flow-engine/nodes/question/QuestionNodeHandler.js";
import { MenuNodeHandler } from "../../flow-engine/nodes/menu/MenuNodeHandler.js";
import { MessageNodeHandler, messageCursorKey } from "../../flow-engine/nodes/message/MessageNodeHandler.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// FASE C6, lado del motor: cuándo sigue un Programador (espera, fecha, horario
// y zona del negocio) y qué hace cada bloque cuando lo despierta la cola.
// ---------------------------------------------------------------------------

const BOGOTA = "America/Bogota";
const config = (patch: Partial<IntervalConfig>): IntervalConfig => ({ ...readIntervalConfig({}), schedule: EMPTY_SCHEDULE, ...patch });
const week = (days: Partial<Record<keyof typeof EMPTY_SCHEDULE, Array<{ start: string; end: string }>>>) =>
  Object.fromEntries(Object.entries(EMPTY_SCHEDULE).map(([day]) => [day, { enabled: Boolean(days[day as keyof typeof days]), ranges: days[day as keyof typeof days] ?? [] }])) as unknown as IntervalConfig["schedule"];

describe("resolveResumeAt (Programador)", () => {
  // Sábado 7 nov 2026, 10:00 en Bogotá (UTC-5) = 15:00 UTC.
  const saturday10 = new Date("2026-11-07T15:00:00.000Z");

  it("espera relativa: ahora + la espera", () => {
    expect(resolveResumeAt(config({ trigger: "interval", wait: { amount: 3, unit: "minutes" } }), saturday10, BOGOTA)!.toISOString()).toBe("2026-11-07T15:03:00.000Z");
    expect(resolveResumeAt(config({ trigger: "interval", wait: { amount: 2, unit: "days" } }), saturday10, BOGOTA)!.toISOString()).toBe("2026-11-09T15:00:00.000Z");
  });

  it("fecha exacta en la hora del negocio; si ya pasó, sigue ya; a medio escribir, no se calcula", () => {
    expect(resolveResumeAt(config({ trigger: "date", moment: { date: "2026-11-10", time: "09:30" } }), saturday10, BOGOTA)!.toISOString()).toBe("2026-11-10T14:30:00.000Z");
    expect(resolveResumeAt(config({ trigger: "date", moment: { date: "2026-11-01", time: "09:30" } }), saturday10, BOGOTA)!.toISOString()).toBe(saturday10.toISOString());
    expect(resolveResumeAt(config({ trigger: "date", moment: { date: "2026-11-10", time: "" } }), saturday10, BOGOTA)).toBeNull();
  });

  it("horario: fuera de franja se aplaza al inicio de la siguiente; dentro, no cambia", () => {
    const weekdays = week({ monday: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }], tuesday: [{ start: "08:00", end: "12:00" }] });
    const wait = (amount: number) => config({ trigger: "interval", wait: { amount, unit: "minutes" }, scheduleEnabled: true, schedule: weekdays });
    // Sábado → lunes 08:00 (13:00 UTC).
    expect(resolveResumeAt(wait(5), saturday10, BOGOTA)!.toISOString()).toBe("2026-11-09T13:00:00.000Z");
    // Lunes 09:00 + 5 min → dentro de la franja.
    expect(resolveResumeAt(wait(5), new Date("2026-11-09T14:00:00.000Z"), BOGOTA)!.toISOString()).toBe("2026-11-09T14:05:00.000Z");
    // Lunes 12:30 → segunda franja 14:00.
    expect(resolveResumeAt(wait(1), new Date("2026-11-09T17:30:00.000Z"), BOGOTA)!.toISOString()).toBe("2026-11-09T19:00:00.000Z");
    // Lunes 18:00 en punto ya está fuera → martes 08:00.
    expect(resolveResumeAt(wait(1), new Date("2026-11-09T22:59:00.000Z"), BOGOTA)!.toISOString()).toBe("2026-11-10T13:00:00.000Z");
  });
});

const node = (type: FlowNode["type"], config: Record<string, unknown>, content: Record<string, unknown> = {}): FlowNode =>
  ({ id: "n1", tenantId: "t", flowVersionId: "v", type, name: type, content, config, metadata: {} }) as FlowNode;
const input = (over: Partial<RuntimeInput> = {}): RuntimeInput => ({
  envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "u", messageId: "m", payload: {}, receivedAt: "2026-11-09T12:00:00.000Z" },
  sessionContext: {},
  isWaitingInput: false,
  now: "2026-11-09T12:00:00.000Z",
  timezone: BOGOTA,
  ...over
});
const session = (context: Record<string, unknown> = {}) => ({ tenantId: "t", flowId: "f", context }) as unknown as Session;

describe("bloques al despertar", () => {
  it("Programador: declara su hora; al despertar sigue; si la hora ya llegó, sigue en el acto", async () => {
    const handler = new DelayNodeHandler();
    const delay = node("delay", { trigger: "interval", wait: { amount: 3, unit: "minutes" } });
    expect(await handler.execute(delay, input(), session())).toMatchObject({ executionStatus: "delayed", nodeResult: { resumeAt: "2026-11-09T12:03:00.000Z" } });
    expect(await handler.execute(delay, input({ timer: "resume" }), session())).toMatchObject({ executionStatus: "success" });
    const past = node("delay", { trigger: "date", moment: { date: "2026-01-01", time: "08:00" } });
    expect(await handler.execute(past, input(), session())).toMatchObject({ executionStatus: "success", domainEvents: ["delay_elapsed:n1"] });
  });

  it("Esperar respuesta: al vencer sale por «tiempo-agotado»; sin límite, un despertador no la saca", async () => {
    const handler = new QuestionNodeHandler();
    const timed = node("question", { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } });
    expect(await handler.execute(timed, input(), session())).toMatchObject({ executionStatus: "waiting_input", nodeResult: { waitDeadlineAt: "2026-11-09T12:30:00.000Z" } });
    expect(await handler.execute(timed, input({ timer: "timeout", isWaitingInput: true }), session())).toMatchObject({ executionStatus: "success", output: "tiempo-agotado" });
    const forever = node("question", { waitIndefinitely: true });
    expect(await handler.execute(forever, input({ timer: "timeout", isWaitingInput: true }), session())).toMatchObject({ executionStatus: "waiting_input" });
  });

  it("Menú: al vencer sale por «menu-timeout» solo si tiene tiempo máximo", async () => {
    const handler = new MenuNodeHandler();
    const options = [{ id: "a", title: "A" }];
    const timed = node("menu", { options, timeoutEnabled: true, timeoutAmount: 2, timeoutUnit: "hours" });
    expect(await handler.execute(timed, input({ timer: "timeout", isWaitingInput: true }), session())).toMatchObject({ executionStatus: "success", output: "menu-timeout" });
    expect(await handler.execute(node("menu", { options }), input({ timer: "timeout", isWaitingInput: true }), session())).toMatchObject({ executionStatus: "waiting_input" });
  });

  it("Mensaje: las pausas caben hasta 20 s por turno; la que no cabe detiene y se retoma justo después, aunque haya otra larga", async () => {
    const handler = new MessageNodeHandler();
    const message = node("message", { items: [
      { id: "a", kind: "text", text: "Uno" },
      { id: "p1", kind: "interval", amount: 6, unit: "seconds" },
      { id: "b", kind: "text", text: "Dos" },
      { id: "p2", kind: "interval", amount: 20, unit: "seconds" },
      { id: "c", kind: "text", text: "Tres" },
      { id: "p3", kind: "interval", amount: 2, unit: "minutes" },
      { id: "d", kind: "text", text: "Cuatro" }
    ] });
    const contents = (result: { outputMessages: ReadonlyArray<{ kind?: string; content: string }> }) => result.outputMessages.filter((m) => m.kind !== "pause").map((m) => m.content);

    const first = await handler.execute(message, input(), session());
    expect(first).toMatchObject({ executionStatus: "delayed", nodeResult: { resumeAt: "2026-11-09T12:00:26.000Z" } });
    expect(contents(first)).toEqual(["Uno", "Dos"]);
    expect(first.contextPatch[messageCursorKey("n1")]).toBe(4);

    const second = await handler.execute(message, input({ timer: "resume" }), session({ [messageCursorKey("n1")]: 4 }));
    expect(second).toMatchObject({ executionStatus: "delayed", nodeResult: { resumeAt: "2026-11-09T12:02:00.000Z" } });
    expect(contents(second)).toEqual(["Tres"]);

    const third = await handler.execute(message, input({ timer: "resume" }), session({ [messageCursorKey("n1")]: 6 }));
    expect(third.executionStatus).toBe("success");
    expect(contents(third)).toEqual(["Cuatro"]);
    expect(third.contextPatch[messageCursorKey("n1")]).toBeNull();

    // Pausas que caben: todo en un turno, como antes.
    const short = node("message", { items: [{ id: "a", kind: "text", text: "Hola" }, { id: "p", kind: "interval", amount: 5, unit: "seconds" }, { id: "b", kind: "text", text: "Chao" }] });
    expect(await handler.execute(short, input(), session())).toMatchObject({ executionStatus: "success" });
  });
});
