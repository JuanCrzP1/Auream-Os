import { describe, expect, it } from "vitest";
import { groupName, requireCampaignDraft, slugify } from "../../domains/groups/domain/Campaign.js";
import { requirePost, welcomeText } from "../../domains/groups/domain/GroupPost.js";
import { connectionFor, currentGroup, needsNextGroup, nextPosition, stateOf } from "../../domains/groups/domain/Rotation.js";
import { parseUazapiGroupEvent, toMember, toProviderGroup } from "../../infrastructure/whatsapp/uazapi/parseUazapiGroups.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";

// ---------------------------------------------------------------------------
// Reglas de Grupos: la campaña que se acepta, a qué grupo lleva el enlace y
// cuándo se prepara el siguiente, la bienvenida agrupada, los envíos y cómo
// se leen los grupos y los avisos de uazapi.
// ---------------------------------------------------------------------------

const group = (position: number, members: number, inviteLink: string | null = "https://chat.whatsapp.com/x") => ({ id: `g${position}`, position, members, state: "open" as const, inviteLink });

describe("la campaña", () => {
  it("normaliza: enlace desde el nombre, cupo y plantilla por defecto", () => {
    const draft = requireCampaignDraft({ name: "Lanzamiento Navidad", connectionIds: ["c1"] });
    expect(draft).toMatchObject({ slug: "lanzamiento-navidad", capacity: 1000, template: { namePattern: "Lanzamiento Navidad", announce: true, locked: true }, rules: { labelOnJoin: true, welcome: { enabled: true, everyMinutes: 15 } } });
    expect(slugify("Ñandú Café 2026!")).toBe("nandu-cafe-2026");
    expect(groupName("Navidad · Dilo cantando", 3)).toBe("Navidad · Dilo cantand #3");
    expect(groupName("Navidad", 12)).toBe("Navidad #12");
  });

  it("rechaza lo que no sirve", () => {
    expect(() => requireCampaignDraft({ name: "", connectionIds: ["c1"] })).toThrow(ValidationError);
    expect(() => requireCampaignDraft({ name: "X", slug: "a b", connectionIds: ["c1"] })).toThrow(/enlace/);
    expect(() => requireCampaignDraft({ name: "Promo", connectionIds: [] })).toThrow(/número/);
    expect(() => requireCampaignDraft({ name: "Promo", connectionIds: ["c1"], capacity: 2000 })).toThrow(/cupo/);
  });
});

describe("a qué grupo lleva el enlace", () => {
  it("al de menor número con cupo y enlace", () => {
    expect(currentGroup([group(2, 10), group(1, 1000), group(3, 0)], 1000)?.id).toBe("g2");
    expect(currentGroup([group(1, 1000)], 1000)).toBeNull();
    expect(currentGroup([group(1, 5, null)], 1000)).toBeNull();
  });

  it("prepara el siguiente al 90 %, no antes, y no si ya hay uno esperando", () => {
    expect(needsNextGroup([], 1000)).toBe(true);
    expect(needsNextGroup([group(1, 899)], 1000)).toBe(false);
    expect(needsNextGroup([group(1, 900)], 1000)).toBe(true);
    expect(needsNextGroup([group(1, 950), group(2, 0)], 1000)).toBe(false);
    expect(nextPosition([group(1, 0), group(4, 0)])).toBe(5);
  });

  it("el estado de cada grupo y el número que lo crea, por turnos", () => {
    const current = group(2, 10);
    expect(stateOf(group(1, 1000), current, 1000)).toBe("full");
    expect(stateOf(group(2, 10), current, 1000)).toBe("open");
    expect(stateOf(group(3, 1), current, 1000)).toBe("standby");
    expect([1, 2, 3].map((p) => connectionFor(["a", "b"], p))).toEqual(["a", "b", "a"]);
  });
});

describe("bienvenida y envíos", () => {
  it("la bienvenida menciona a los que entraron y resume el resto", () => {
    const people = ["573001", "573002", "573003"].map((phone) => ({ phone }));
    expect(welcomeText("¡Bienvenidos {nombres}! 🎉", people)).toBe("¡Bienvenidos @573001, @573002 y @573003! 🎉");
    expect(welcomeText("Hola {nombres}", people, 1)).toBe("Hola @573001 y 2 más");
    expect(welcomeText("Bienvenidos", people.slice(0, 1))).toBe("Bienvenidos @573001");
  });

  it("un envío necesita destino y contenido completo", () => {
    const now = new Date("2026-11-10T15:00:00Z");
    expect(requirePost({ campaignIds: ["k1"], content: { kind: "text", text: "Hola" } }, now)).toMatchObject({ content: { kind: "text", text: "Hola", mediaUrl: null }, mentionAll: false, scheduledAt: null });
    expect(() => requirePost({ content: { kind: "text", text: "Hola" } }, now)).toThrow(/grupos/);
    expect(() => requirePost({ groupIds: ["g1"], content: { kind: "video", text: "Mira" } }, now)).toThrow(/archivo/);
    expect(() => requirePost({ groupIds: ["g1"], content: { kind: "poll", text: "¿Para quién?", choices: ["Mamá"] } }, now)).toThrow(/opciones/);
    expect(requirePost({ groupIds: ["g1"], content: { kind: "poll", text: "¿Para quién?", choices: ["Mamá", "Pareja", "Mamá"] } }, now).content.choices).toEqual(["Mamá", "Pareja"]);
  });
});

describe("lo que manda uazapi", () => {
  it("miembros como texto u objeto; @lid sin teléfono", () => {
    expect(toMember("573001112233@s.whatsapp.net")).toEqual({ key: "573001112233", phone: "573001112233", isAdmin: false });
    expect(toMember("123456789@lid")).toEqual({ key: "lid:123456789", phone: null, isAdmin: false });
    expect(toMember({ JID: "1@lid", PhoneNumber: "573009998877@s.whatsapp.net", IsAdmin: true })).toEqual({ key: "573009998877", phone: "573009998877", isAdmin: true });
    expect(toMember("x")).toBeNull();
  });

  it("un grupo: si el número conectado es administrador; las comunidades se marcan", () => {
    const raw = { JID: "120363000000000001@g.us", Name: "Navidad #1", Topic: "Hola", ParticipantCount: 2, IsAnnounce: true, Participants: [{ PhoneNumber: "573000000001", IsAdmin: true }, { JID: "573000000002@s.whatsapp.net" }] };
    expect(toProviderGroup(raw, "573000000001")).toMatchObject({ jid: "120363000000000001@g.us", isAdmin: true, announce: true, memberCount: 2, isCommunity: false });
    expect(toProviderGroup(raw, "573000000002")?.isAdmin).toBe(false);
    expect(toProviderGroup({ ...raw, IsParent: true }, null)?.isCommunity).toBe(true);
    expect(toProviderGroup({ JID: "123@s.whatsapp.net" }, null)).toBeNull();
  });

  it("el aviso de entradas y salidas", () => {
    const event = parseUazapiGroupEvent({ EventType: "groups", instanceName: "auream-c1", token: "t", event: { JID: "120363000000000001@g.us", Join: ["573000000003@s.whatsapp.net"], Leave: [{ PhoneNumber: "573000000004" }] } });
    expect(event).toMatchObject({ instanceName: "auream-c1", jid: "120363000000000001@g.us", joins: [{ phone: "573000000003" }], leaves: [{ phone: "573000000004" }] });
    expect(parseUazapiGroupEvent({ EventType: "groups", event: { JID: "120363000000000001@g.us", Name: { Name: "x" } } })).toBeNull();
    expect(parseUazapiGroupEvent({ EventType: "messages" })).toBeNull();
  });
});
