import { describe, expect, it } from "vitest";
import { GroupActivity } from "../../domains/groups/application/GroupActivity.js";
import type { GroupEngine } from "../../domains/groups/application/GroupEngine.js";
import { GroupMaker } from "../../domains/groups/application/GroupMaker.js";
import type { GroupPost, Member, WaGroup } from "../../domains/groups/application/GroupPorts.js";
import { LinkService } from "../../domains/groups/application/LinkService.js";
import { PostDispatcher } from "../../domains/groups/application/PostDispatcher.js";
import { requireCampaignDraft, type Campaign } from "../../domains/groups/domain/Campaign.js";

// ---------------------------------------------------------------------------
// El motor de Grupos en memoria: crear el grupo siguiente (por turnos, con la
// plantilla y su enlace), el enlace único, las entradas con etiqueta y
// bienvenida agrupada, y el envío grupo por grupo con pausa.
// ---------------------------------------------------------------------------

function world() {
  let now = new Date("2026-11-10T15:00:00Z");
  let ids = 0;
  const campaigns = new Map<string, Campaign>();
  const groups = new Map<string, WaGroup>();
  const members = new Map<string, Map<string, Member & { joinedAt: Date; left: boolean }>>();
  const calls: string[] = [];
  const tags: string[] = [];
  const ticks: Array<{ kind: string; at: Date }> = [];
  const sent: Array<{ jid: string; text: string; mentions: unknown }> = [];
  const post: GroupPost = { id: "p1", tenantId: "t", content: { kind: "text", text: "Abrimos", mediaUrl: null, fileName: null, choices: [] }, mentionAll: true, status: "scheduled", target: "", campaignIds: [], scheduledAt: null, finishedAt: null, createdAt: now.toISOString() };
  const deliveries: Array<{ id: string; groupId: string; status: string }> = [];
  let postState = post;
  const engine: GroupEngine = {
    campaigns: {
      create: async (c) => void campaigns.set(c.id, c), update: async (_t, c) => void campaigns.set(c.id, c), find: async (_t, id) => campaigns.get(id) ?? null,
      findBySlug: async (slug) => [...campaigns.values()].find((c) => c.slug === slug) ?? null, list: async () => [...campaigns.values()], slugTaken: async () => false
    },
    groups: {
      list: async (_t, campaignId) => [...groups.values()].filter((g) => !campaignId || g.campaignId === campaignId),
      find: async (_t, id) => groups.get(id) ?? null,
      findByJid: async (_t, _c, jid) => [...groups.values()].find((g) => g.jid === jid) ?? null,
      saveSynced: async () => undefined,
      insertCreated: async (g) => ([...groups.values()].some((x) => x.campaignId === g.campaignId && x.position === g.position) ? false : (groups.set(g.id, g), true)),
      update: async (_t, id, patch) => void groups.set(id, { ...groups.get(id)!, ...patch }),
      applyMoves: async (_t, groupId, joins, leaves, at) => {
        const list = members.get(groupId) ?? new Map();
        const fresh = joins.filter((m) => !list.get(m.key) || list.get(m.key)!.left);
        for (const m of joins) list.set(m.key, { ...m, joinedAt: at, left: false });
        for (const m of leaves) if (list.get(m.key)) list.get(m.key)!.left = true;
        members.set(groupId, list);
        groups.set(groupId, { ...groups.get(groupId)!, members: 1 + [...list.values()].filter((m) => !m.left).length });
        return fresh;
      },
      joinedSince: async (_t, groupId, since) => [...(members.get(groupId)?.values() ?? [])].filter((m) => !m.left && m.joinedAt > since && m.phone).map((m) => m.phone!),
      recordClick: async () => void calls.push("click"), lastSyncedAt: async () => null
    },
    posts: {
      create: async () => undefined, find: async () => postState, list: async () => [],
      transition: async (_t, _id, from, to) => (from.includes(postState.status) ? ((postState = { ...postState, status: to }), true) : false),
      claimNext: async () => { const d = deliveries.find((x) => x.status === "pending"); if (!d) return null; d.status = "sending"; return { deliveryId: d.id, groupId: d.groupId }; },
      finishDelivery: async (_t, id, outcome) => void (deliveries.find((d) => d.id === id)!.status = outcome.ok ? "sent" : "failed"), cancelPending: async () => undefined
    },
    results: { groups: async () => new Map(), campaigns: async () => new Map(), daily: async () => [] },
    gateway: {
      list: async () => [],
      create: async (_t, connectionId, name) => (calls.push(`create:${connectionId}:${name}`), { jid: `12036300000000000${++ids}@g.us` }),
      configure: async (_t, _c, _j, settings) => void calls.push(`configure:${Object.keys(settings).join(",")}`),
      inviteLink: async (_t, _c, jid) => `https://chat.whatsapp.com/${jid.slice(0, 18)}`,
      send: async (_t, _c, jid, content, mentions) => (sent.push({ jid, text: content.text, mentions }), "w1")
    },
    numbers: { list: async () => [{ id: "c1", name: "Ventas 1", connected: true, qr: true }, { id: "c2", name: "Ventas 2", connected: true, qr: true }] },
    labeler: { tag: async (_t, phone, label) => void tags.push(`${phone}:${label}`) },
    ticker: {
      sync: async (_t, at) => void ticks.push({ kind: "sync", at }), prepare: async (_t, _c, at) => void ticks.push({ kind: "prepare", at }), welcome: async (_t, _g, at) => void ticks.push({ kind: "welcome", at }),
      post: async (_t, _p, at) => void ticks.push({ kind: "post", at }), apply: async () => undefined, stopPost: async () => undefined
    },
    timezoneOf: async () => "America/Bogota", now: () => now, random: () => 0, newId: () => `id${++ids}`, linkBase: "https://app.test/g"
  };
  const campaign: Campaign = { ...requireCampaignDraft({ name: "Navidad", connectionIds: ["c1", "c2"], capacity: 20, template: { namePattern: "Navidad", description: "Ofertas" } }), id: "k1", tenantId: "t", status: "active", createdAt: now.toISOString() };
  campaigns.set(campaign.id, campaign);
  const maker = new GroupMaker(engine);
  return { engine, campaigns, groups, calls, tags, ticks, sent, deliveries, maker, link: new LinkService(engine, maker), activity: new GroupActivity(engine), dispatcher: new PostDispatcher(engine), advance: (ms: number) => (now = new Date(now.getTime() + ms)), post: () => postState };
}

const joiner = (n: number): Member => ({ key: `57300000${n}`, phone: `57300000${n}`, isAdmin: false });

describe("el motor de Grupos", () => {
  it("el enlace sin grupos crea el primero (con la plantilla) y lleva a él; no crea otro si no hace falta", async () => {
    const w = world();
    const outcome = await w.link.click("navidad", "anuncio");
    expect(outcome).toEqual({ kind: "redirect", url: expect.stringMatching(/^https:\/\/chat\.whatsapp\.com\//) });
    expect(w.calls).toContain("create:c1:Navidad #1");
    expect(w.calls).toContain("configure:description,announce,locked");
    expect(w.calls).toContain("click");
    expect(await w.maker.prepare("t", "k1")).toBeNull();
    expect(await w.link.click("otra", null)).toEqual({ kind: "missing" });
    w.campaigns.set("k1", { ...w.campaigns.get("k1")!, status: "closed" });
    expect(await w.link.click("navidad", null)).toEqual({ kind: "closed" });
  });

  it("al llegar al 90 % se prepara el siguiente por el otro número; lleno, el enlace lleva al nuevo", async () => {
    const w = world();
    const first = (await w.maker.prepare("t", "k1"))!;
    await w.activity.handle("t", "c1", { jid: first.jid, joins: Array.from({ length: 17 }, (_, i) => joiner(i)), leaves: [] });
    expect(w.groups.get(first.id)!.members).toBe(18);
    const second = (await w.maker.prepare("t", "k1"))!;
    expect(second).toMatchObject({ position: 2, connectionId: "c2", name: "Navidad #2" });
    await w.activity.handle("t", "c1", { jid: first.jid, joins: [joiner(40), joiner(41)], leaves: [] });
    const outcome = await w.link.click("navidad", null);
    expect(outcome).toEqual({ kind: "redirect", url: second.inviteLink });
  });

  it("quien entra queda etiquetado y la bienvenida sale agrupada, una vez por tanda", async () => {
    const w = world();
    const group = (await w.maker.prepare("t", "k1"))!;
    w.advance(60_000);
    await w.activity.handle("t", "c1", { jid: group.jid, joins: [joiner(1), joiner(2)], leaves: [] });
    await w.activity.handle("t", "c1", { jid: group.jid, joins: [joiner(1)], leaves: [] });
    expect(w.tags).toEqual(["573000001:Navidad", "573000002:Navidad"]);
    expect(w.ticks.find((t) => t.kind === "welcome")!.at.toISOString()).toBe("2026-11-10T15:15:00.000Z");
    w.advance(15 * 60_000);
    await w.activity.welcome("t", group.id);
    await w.activity.welcome("t", group.id);
    expect(w.sent).toEqual([{ jid: group.jid, text: "¡Bienvenidos @573000001 y @573000002! 🎉 Aquí compartimos las novedades primero.", mentions: ["573000001", "573000002"] }]);
  });

  it("un envío sale grupo por grupo, con mención a todos y pausa al azar, y termina", async () => {
    const w = world();
    const a = (await w.maker.prepare("t", "k1"))!;
    w.deliveries.push({ id: "d1", groupId: a.id, status: "pending" }, { id: "d2", groupId: "no-existe", status: "pending" });
    await w.dispatcher.tick("t", "p1");
    expect(w.sent).toEqual([{ jid: a.jid, text: "Abrimos", mentions: "all" }]);
    expect(w.ticks.at(-1)).toMatchObject({ kind: "post", at: new Date("2026-11-10T15:00:10.000Z") });
    await w.dispatcher.tick("t", "p1");
    expect(w.deliveries.map((d) => d.status)).toEqual(["sent", "failed"]);
    await w.dispatcher.tick("t", "p1");
    expect(w.post().status).toBe("done");
  });
});
