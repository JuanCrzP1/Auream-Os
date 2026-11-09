import { describe, expect, it } from "vitest";
import { LivePoller, type PollerEnvironment } from "../../src/shared/conversations/LivePoller";
import { isRecent, mergeThread } from "../../src/shared/conversations/mergeThread";
import type { ConversationMessage } from "@contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// El «en vivo» de la bandeja sin conexiones abiertas: una consulta a la vez,
// más seguido con movimiento, nada con la pestaña oculta; y la unión del hilo
// por id, en orden, sin repintar si nada cambió.
// ---------------------------------------------------------------------------

/** Navegador falso: reloj manual, temporizadores y pestaña visible u oculta. */
function fakeEnvironment() {
  const state = { now: 0, hidden: false, timers: [] as Array<{ at: number; run: () => void; id: number }>, listeners: [] as Array<() => void>, ids: 0 };
  const env: PollerEnvironment = {
    now: () => state.now,
    hidden: () => state.hidden,
    setTimeout: (run, ms) => {
      const id = ++state.ids;
      state.timers.push({ at: state.now + ms, run, id });
      return id;
    },
    clearTimeout: (handle) => {
      state.timers = state.timers.filter((timer) => timer.id !== handle);
    },
    onVisibilityChange: (listener) => {
      state.listeners.push(listener);
      return () => (state.listeners = state.listeners.filter((known) => known !== listener));
    }
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  /** Avanza el reloj y dispara lo que venza. */
  const advance = async (ms: number) => {
    state.now += ms;
    const due = state.timers.filter((timer) => timer.at <= state.now);
    state.timers = state.timers.filter((timer) => timer.at > state.now);
    due.forEach((timer) => timer.run());
    await flush();
  };
  const setHidden = async (hidden: boolean) => {
    state.hidden = hidden;
    state.listeners.forEach((listener) => listener());
    await flush();
  };
  const nextDelay = () => (state.timers[0] ? state.timers[0].at - state.now : null);
  return { env, state, advance, setHidden, nextDelay, flush };
}

const TIMING = { activeMs: 1_500, idleMs: 4_000, activeWindowMs: 60_000 };

describe("LivePoller", () => {
  it("en calma consulta cada 4 s; tras un cambio, cada 1,5 s durante un minuto", async () => {
    const f = fakeEnvironment();
    const answers = [false, true];
    let calls = 0;
    const poller = new LivePoller(async () => answers[calls++] ?? false, TIMING, f.env);
    poller.start();
    await f.flush();
    expect(calls).toBe(1);
    expect(f.nextDelay()).toBe(4_000);
    await f.advance(4_000);
    expect(calls).toBe(2);
    expect(f.nextDelay()).toBe(1_500);
    await f.advance(60_000);
    expect(f.nextDelay()).toBe(4_000);
    poller.stop();
    await f.advance(10_000);
    expect(f.state.timers).toEqual([]);
  });

  it("una consulta a la vez: pedir otra mientras corre la hace al terminar, una sola vez", async () => {
    const f = fakeEnvironment();
    const releases: Array<() => void> = [];
    let calls = 0;
    const poller = new LivePoller(() => new Promise<boolean>((resolve) => { calls += 1; releases.push(() => resolve(false)); }), TIMING, f.env);
    poller.start();
    poller.nudge();
    poller.nudge();
    expect(calls).toBe(1);
    releases[0]!();
    await f.flush();
    expect(calls).toBe(2);
    releases[1]!();
    await f.flush();
    expect(calls).toBe(2);
    // El empujón deja el chat en movimiento.
    expect(f.nextDelay()).toBe(1_500);
    poller.stop();
  });

  it("con la pestaña oculta no consulta; al volver consulta enseguida", async () => {
    const f = fakeEnvironment();
    let calls = 0;
    const poller = new LivePoller(async () => (calls += 1) < 0, TIMING, f.env);
    poller.start();
    await f.flush();
    await f.setHidden(true);
    await f.advance(30_000);
    expect(calls).toBe(1);
    await f.setHidden(false);
    expect(calls).toBe(2);
    poller.stop();
    expect(f.state.listeners).toEqual([]);
  });

  it("un fallo suelto no detiene el vivo", async () => {
    const f = fakeEnvironment();
    let calls = 0;
    const poller = new LivePoller(async () => {
      calls += 1;
      if (calls === 1) throw new Error("sin red");
      return false;
    }, TIMING, f.env);
    poller.start();
    await f.flush();
    await f.advance(4_000);
    expect(calls).toBe(2);
    poller.stop();
  });
});

const message = (id: string, over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id, conversationId: "c1", direction: "outbound", author: "bot", kind: "text", text: id, mediaUrl: null, mediaType: null,
  options: [], status: "sent", error: null, flowName: null, agentName: null, createdAt: "2026-11-09T12:00:00.000Z", ...over
});

describe("mergeThread", () => {
  it("une por id: lo nuevo en su lugar (por hora) y lo cambiado reemplazado; si nada cambia, la misma lista", () => {
    const current = [message("a", { createdAt: "2026-11-09T12:00:01.000Z" }), message("c", { createdAt: "2026-11-09T12:00:03.000Z" })];
    const merged = mergeThread(current, [message("c", { createdAt: "2026-11-09T12:00:03.000Z", status: "read" }), message("b", { createdAt: "2026-11-09T12:00:02.000Z" })]);
    expect(merged.changed).toBe(true);
    expect(merged.messages.map((m) => [m.id, m.status])).toEqual([["a", "sent"], ["b", "sent"], ["c", "read"]]);

    const again = mergeThread(merged.messages, [message("c", { createdAt: "2026-11-09T12:00:03.000Z", status: "read" })]);
    expect(again.changed).toBe(false);
    expect(again.messages).toBe(merged.messages);
  });

  it("un chat con un mensaje de hace menos de un minuto está en movimiento", () => {
    const now = Date.parse("2026-11-09T12:01:00.000Z");
    expect(isRecent(message("a", { createdAt: "2026-11-09T12:00:30.000Z" }), 60_000, now)).toBe(true);
    expect(isRecent(message("a", { createdAt: "2026-11-09T11:59:00.000Z" }), 60_000, now)).toBe(false);
    expect(isRecent(undefined, 60_000, now)).toBe(false);
  });
});
