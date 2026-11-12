import type { Simulator } from "../core/Simulator";
import { groupJid, inviteCode } from "../core/ids";
import type { SimGroup } from "../core/types";
import { sendJson, text, type RouteContext, type Router } from "../http/http";
import { groupInfo } from "../webhooks/uazapiEvents";
import { instanceOf } from "./auth";

// ---------------------------------------------------------------------------
// Grupos, como en uazapi (Grupos y comunidades de Auream):
//
//   POST /group/list                     { limit, offset }
//   POST /group/create                   { name, participants }
//   POST /group/update{Name,Description,Image,Announce,Locked}   { groupjid, … }
//   GET  /group/invitelink/:jid
//
// Quién entra o sale se simula desde el teléfono de prueba (aviso `groups`).
// ---------------------------------------------------------------------------

type GroupChange = (group: SimGroup, body: Record<string, unknown>) => void;

const UPDATES: Readonly<Record<string, GroupChange>> = {
  updateName: (group, body) => void (group.name = text(body["name"]).slice(0, 25)),
  updateDescription: (group, body) => void (group.description = text(body["description"]).slice(0, 512)),
  updateImage: (group, body) => void (group.image = text(body["image"]) === "remove" ? null : text(body["image"]) || null),
  updateAnnounce: (group, body) => void (group.announce = body["announce"] === true),
  updateLocked: (group, body) => void (group.locked = body["locked"] === true)
};

export function registerGroupApi(router: Router, simulator: Simulator): void {
  const { store } = simulator;
  const ownGroups = (instanceId: string) => [...store.groups.values()].filter((group) => group.instanceId === instanceId);

  router.on("POST", "/group/list", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const body = await context.body();
    const all = ownGroups(instance.id);
    const offset = Number(body["offset"]) || 0;
    const limit = Number(body["limit"]) || 100;
    const page = all.slice(offset, offset + limit);
    const hasMore = offset + page.length < all.length;
    sendJson(context.response, 200, { groups: page.map((group) => groupInfo(instance, group)), pagination: { hasMore, nextOffset: offset + page.length } });
  });

  router.on("POST", "/group/create", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const body = await context.body();
    const group: SimGroup = {
      jid: groupJid(), instanceId: instance.id, name: text(body["name"]).slice(0, 25) || "Grupo", description: "", announce: false, locked: false,
      image: null, inviteCode: inviteCode(), participants: Array.isArray(body["participants"]) ? body["participants"].map(text).filter(Boolean) : []
    };
    store.groups.set(group.jid, group);
    store.changed();
    store.record("in", `crear grupo «${group.name}»`);
    sendJson(context.response, 200, { group: groupInfo(instance, group) });
  });

  for (const [action, change] of Object.entries(UPDATES)) {
    router.on("POST", `/group/${action}`, async (context: RouteContext) => {
      const instance = instanceOf(store, context);
      if (!instance) return;
      const body = await context.body();
      const group = store.groups.get(text(body["groupjid"]));
      if (!group || group.instanceId !== instance.id) return sendJson(context.response, 404, { error: "group not found" });
      change(group, body);
      store.changed();
      store.record("in", `grupo «${group.name}»: ${action}`);
      sendJson(context.response, 200, { group: groupInfo(instance, group) });
    });
  }

  router.on("GET", "/group/invitelink/:jid", (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const group = store.groups.get(context.params["jid"]!);
    if (!group) return sendJson(context.response, 404, { error: "group not found" });
    sendJson(context.response, 200, { inviteLink: `https://chat.whatsapp.com/${group.inviteCode}` });
  });
}
