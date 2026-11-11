import { describe, expect, it } from "vitest";
import { DEFAULT_BROADCAST_SETTINGS, EMPTY_AUDIENCE } from "../../contracts/BroadcastContracts.js";
import type { BroadcastStatus } from "../../contracts/BroadcastResultsContracts.js";
import { BroadcastDispatcher } from "../../domains/broadcasts/application/BroadcastDispatcher.js";
import type { BroadcastEngine } from "../../domains/broadcasts/application/BroadcastEngine.js";
import { BroadcastLauncher } from "../../domains/broadcasts/application/BroadcastLauncher.js";
import type { Candidate, SendOutcome } from "../../domains/broadcasts/application/BroadcastPorts.js";
import { OptOutListener } from "../../domains/broadcasts/application/OptOutListener.js";
import type { Broadcast } from "../../domains/broadcasts/domain/Broadcast.js";

// ---------------------------------------------------------------------------
// El motor de las difusiones con todo en memoria: arranca con la lista, envía
// de a uno con su pausa, respeta horario, tope y «SALIR», se pausa solo con
// muchos fallos o el número caído, decide la prueba A/B y lanza el segundo envío.
// ---------------------------------------------------------------------------

type Row = Candidate & { id: string; variant: number | null; status: string; sentAt: Date | null; error: string | null };

function world(options: { now?: Date; connected?: boolean; send?: (target: Candidate) => SendOutcome; people?: number } = {}) {
  let now = options.now ?? new Date("2026-11-10T15:00:00Z");
  const broadcasts = new Map<string, Broadcast>();
  const rows: Row[] = [];
  const optedOut = new Set<string>();
  const ticks: Array<{ kind: string; at: Date; connectionId?: string }> = [];
  const sent: Array<{ phone: string; text?: string; flow?: string }> = [];
  const people: Candidate[] = Array.from({ length: options.people ?? 3 }, (_, i) => ({ contactId: `k${i}`, name: `Cliente ${i}`, phone: `57300000000${i}`, connectionId: "c1" }));
  let ids = 0;
  const engine: BroadcastEngine = {
    broadcasts: {
      create: async (b) => void (b.parentId && [...broadcasts.values()].some((x) => x.parentId === b.parentId) ? null : broadcasts.set(b.id, b)),
      find: async (_t, id) => broadcasts.get(id) ?? null,
      list: async () => [...broadcasts.values()],
      transition: async (_t, id, from, to: BroadcastStatus, patch = {}) => {
        const b = broadcasts.get(id);
        if (!b || !from.includes(b.status)) return false;
        broadcasts.set(id, { ...b, ...patch, status: to });
        return true;
      },
      update: async (_t, id, patch) => void broadcasts.set(id, { ...broadcasts.get(id)!, ...patch }),
      childOf: async (_t, parentId) => [...broadcasts.values()].find((b) => b.parentId === parentId)?.id ?? null
    },
    recipients: {
      insert: async (_t, broadcastId, list) => list.forEach((c) => rows.push({ ...c, id: `${broadcastId}:${c.phone}`, status: "pending", sentAt: null, error: null })) ?? list.length,
      claimNext: async (_t, broadcastId, connectionId) => {
        const row = rows.find((r) => r.id.startsWith(broadcastId) && r.connectionId === connectionId && r.status === "pending" && r.variant !== null);
        if (!row) return null;
        row.status = "sending";
        return { ...row, variant: row.variant! };
      },
      finish: async (_t, id, outcome) => void Object.assign(rows.find((r) => r.id === id)!, { status: outcome.status, sentAt: outcome.status === "sent" ? outcome.at : null, error: outcome.error }),
      expireStale: async () => 0,
      attempts: async (_t, b) => ({ attempted: rows.filter((r) => r.id.startsWith(b) && ["sent", "failed"].includes(r.status)).length, failed: rows.filter((r) => r.id.startsWith(b) && r.status === "failed").length }),
      work: async (_t, b) => {
        const mine = rows.filter((r) => r.id.startsWith(b));
        return { pendingByConnection: [...new Set(mine.filter((r) => r.status === "pending" && r.variant !== null).map((r) => r.connectionId))], held: mine.filter((r) => r.status === "pending" && r.variant === null).length, inFlight: mine.filter((r) => r.status === "sending").length };
      },
      assignHeld: async (_t, b, variant) => rows.filter((r) => r.id.startsWith(b) && r.variant === null).map((r) => (r.variant = variant)).length,
      cancelPending: async () => 0,
      sentSince: async (_t, c, since) => rows.filter((r) => r.connectionId === c && r.status === "sent" && r.sentAt! >= since).length,
      daysWithSends: async () => 10
    },
    audience: { resolve: async () => ({ candidates: people, optedOut: 0 }), nonResponders: async (_t, parentId) => rows.filter((r) => r.id.startsWith(parentId) && r.status === "sent" && r.phone !== people[0]!.phone) },
    optOuts: { add: async (_t, phone) => void optedOut.add(phone), has: async (_t, phone) => optedOut.has(phone) },
    results: { stats: async () => new Map(), recipients: async () => ({ recipients: [], counts: {} as never, nextOffset: null }), variants: async () => [{ variant: 0, sent: 1, replied: 0, bought: 0, revenue: [] }, { variant: 1, sent: 1, replied: 1, bought: 1, revenue: [{ currency: "COP", amount: 50000 }] }] },
    sender: {
      sendFlow: async (_t, target, flow) => (sent.push({ phone: target.phone, flow }), options.send?.(target) ?? { ok: true, providerMessageId: "w1", error: null }),
      sendMessage: async (_t, target, message) => (sent.push({ phone: target.phone, text: message.text }), options.send?.(target) ?? { ok: true, providerMessageId: "w1", error: null })
    },
    numbers: { list: async () => [{ id: "c1", name: "Ventas 1", connected: options.connected ?? true, canBroadcast: true }] },
    flows: { find: async () => new Map() },
    ticker: {
      start: async (_t, _b, at) => void ticks.push({ kind: "start", at }),
      tick: async (_t, _b, connectionId, at) => void ticks.push({ kind: "tick", at, connectionId }),
      decide: async (_t, _b, at) => void ticks.push({ kind: "decide", at }),
      followUp: async (_t, _b, at) => void ticks.push({ kind: "followUp", at }),
      stop: async () => void ticks.push({ kind: "stop", at: now }),
      next: async () => null
    },
    timezoneOf: async () => "America/Bogota",
    now: () => now,
    random: () => 0,
    newId: () => `b${++ids}`
  };
  const add = (patch: Partial<Broadcast> = {}) => {
    const b: Broadcast = { id: `b${++ids}`, tenantId: "t", name: "Promo", variants: [{ kind: "message", text: "Hola {first_name}", media: null }], audience: EMPTY_AUDIENCE, connectionIds: ["c1"], scheduledAt: null, settings: { ...DEFAULT_BROADCAST_SETTINGS, optOutFooter: false }, abTest: null, followUp: null, status: "scheduled", statusReason: null, parentId: null, winner: null, decidesAt: null, followUpDueAt: null, followUpChildId: null, startedAt: null, finishedAt: null, createdBy: null, createdAt: now.toISOString(), ...patch };
    broadcasts.set(b.id, b);
    return b;
  };
  return { engine, broadcasts, rows, ticks, sent, optedOut, add, launcher: new BroadcastLauncher(engine), dispatcher: new BroadcastDispatcher(engine), setNow: (d: Date) => (now = d) };
}

async function drain(w: ReturnType<typeof world>, id: string, max = 20) {
  for (let i = 0; i < max && w.broadcasts.get(id)!.status === "sending"; i++) await w.dispatcher.tick("t", id, "c1");
}

describe("el motor de las difusiones", () => {
  it("arranca con la lista y envía de a uno, con su nombre y una pausa al azar, hasta terminar", async () => {
    const w = world();
    const b = w.add();
    await w.launcher.start("t", b.id);
    expect(w.rows).toHaveLength(3);
    expect(w.broadcasts.get(b.id)!.status).toBe("sending");
    await w.dispatcher.tick("t", b.id, "c1");
    expect(w.sent).toEqual([{ phone: expect.stringMatching(/^57300000000\d$/), text: "Hola Cliente" }]);
    expect(w.ticks.at(-1)).toMatchObject({ kind: "tick", connectionId: "c1", at: new Date(Date.parse("2026-11-10T15:00:00Z") + 8000) });
    await drain(w, b.id);
    expect(w.sent).toHaveLength(3);
    expect(w.broadcasts.get(b.id)!.status).toBe("done");
  });

  it("fuera del horario no envía: sigue cuando abre", async () => {
    const w = world({ now: new Date("2026-11-11T02:00:00Z") }); // 9 p. m. en Bogotá
    const b = w.add();
    await w.launcher.start("t", b.id);
    await w.dispatcher.tick("t", b.id, "c1");
    expect(w.sent).toHaveLength(0);
    expect(w.ticks.at(-1)).toMatchObject({ kind: "tick", at: new Date("2026-11-11T13:00:00Z") });
  });

  it("con el tope del día lleno, sigue mañana", async () => {
    const w = world({ people: 3 });
    const b = w.add({ settings: { ...DEFAULT_BROADCAST_SETTINGS, dailyCap: 20 } });
    await w.launcher.start("t", b.id);
    for (let i = 0; i < 20; i++) w.rows.push({ contactId: null, name: null, phone: `5799${i}`, connectionId: "c1", id: `otra:${i}`, variant: 0, status: "sent", sentAt: new Date("2026-11-10T14:00:00Z"), error: null });
    await w.dispatcher.tick("t", b.id, "c1");
    expect(w.sent).toHaveLength(0);
    expect(w.ticks.at(-1)!.at.toISOString()).toBe("2026-11-11T13:00:00.000Z");
  });

  it("quien dijo «SALIR» se salta", async () => {
    const w = world();
    await new OptOutListener(w.engine.optOuts).heard("t", { phone: "573000000000", text: "SALIR" });
    const b = w.add();
    await w.launcher.start("t", b.id);
    await drain(w, b.id);
    expect(w.sent.map((s) => s.phone).sort()).toEqual(["573000000001", "573000000002"]);
    expect(w.rows.find((r) => r.phone === "573000000000")!.status).toBe("opted_out");
  });

  it("se pausa sola con muchos fallos o con el número desconectado", async () => {
    const failing = world({ people: 25, send: () => ({ ok: false, providerMessageId: null, error: "Número sin WhatsApp" }) });
    const b = failing.add();
    await failing.launcher.start("t", b.id);
    await drain(failing, b.id, 30);
    expect(failing.broadcasts.get(b.id)).toMatchObject({ status: "auto_paused", statusReason: expect.stringContaining("fallaron 100 %") });
    expect(failing.sent).toHaveLength(20);

    const offline = world({ connected: false });
    const c = offline.add();
    await offline.launcher.start("t", c.id);
    await offline.dispatcher.tick("t", c.id, "c1");
    expect(offline.broadcasts.get(c.id)!.statusReason).toContain("«Ventas 1» se desconectó");
  });

  it("prueba A/B: una parte prueba, gana la que más vendió y le llega al resto", async () => {
    const w = world({ people: 10 });
    const b = w.add({ variants: [{ kind: "message", text: "A", media: null }, { kind: "message", text: "B", media: null }], abTest: { sharePercent: 20, decideAfterHours: 6 } });
    await w.launcher.start("t", b.id);
    await drain(w, b.id);
    expect(w.sent.map((s) => s.text)).toEqual(["A", "B"]);
    expect(w.broadcasts.get(b.id)!.status).toBe("testing");
    expect(w.ticks.find((t) => t.kind === "decide")!.at.toISOString()).toBe("2026-11-10T21:00:00.000Z");
    await w.launcher.decide("t", b.id);
    expect(w.broadcasts.get(b.id)).toMatchObject({ status: "sending", winner: 1 });
    await drain(w, b.id);
    expect(w.sent.slice(2).every((s) => s.text === "B")).toBe(true);
    expect(w.sent).toHaveLength(10);
  });

  it("segundo envío: horas después, solo a los que no respondieron, una sola vez", async () => {
    const w = world();
    const b = w.add({ followUp: { afterHours: 48, content: { kind: "message", text: "¿Lo pensaste?", media: null } } });
    await w.launcher.start("t", b.id);
    await drain(w, b.id);
    expect(w.ticks.find((t) => t.kind === "followUp")!.at.toISOString()).toBe("2026-11-12T15:00:00.000Z");
    await w.launcher.followUp("t", b.id);
    await w.launcher.followUp("t", b.id);
    const child = [...w.broadcasts.values()].filter((x) => x.parentId === b.id);
    expect(child).toHaveLength(1);
    expect(child[0]).toMatchObject({ name: "Promo · segundo envío", status: "sending" });
    expect(w.broadcasts.get(b.id)!.followUpChildId).toBe(child[0]!.id);
    await drain(w, child[0]!.id);
    expect(w.sent.slice(3).map((s) => s.phone).sort()).toEqual(["573000000001", "573000000002"]);
  });
});
