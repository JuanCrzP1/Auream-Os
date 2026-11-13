import { describe, expect, it, vi } from "vitest";
import { McpProtocol } from "../../apps/api/mcp/McpProtocol.js";
import type { McpTool, McpToolContext } from "../../apps/api/mcp/McpTool.js";
import { broadcastTools } from "../../apps/api/mcp/tools/broadcastTools.js";
import { groupTools } from "../../apps/api/mcp/tools/groupTools.js";
import { quickReplyTools } from "../../apps/api/mcp/tools/quickReplyTools.js";
import { requirePermissions, scopesOf } from "../../domains/mcp/domain/McpCredential.js";
import type { CampaignSummary } from "../../contracts/GroupContracts.js";
import type { QuickReply } from "../../contracts/QuickReplyContracts.js";

// ---------------------------------------------------------------------------
// MCP de difusiones, grupos y respuestas rápidas: adaptadores finos sobre los
// MISMOS servicios de la pantalla. Se prueba que lleguen con lo pedido (sin
// pisar lo que no), que el agente no es una persona, que `{nombre}` se pone
// igual que en el chat y que cada herramienta aparece solo con su área.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const ctx: McpToolContext = { tenantId: T, credentialId: "22222222-2222-4222-8222-222222222222", credentialName: "Claude" };
const find = (tools: McpTool[], name: string) => tools.find((tool) => tool.name === name)!;

const CAMPAIGN = {
  id: "k1", name: "Navidad", slug: "navidad", link: "https://x/g/navidad", status: "active", connections: [{ id: "c1", name: "Ventas" }], capacity: 500,
  template: { namePattern: "Navidad", description: "Reglas del grupo", imageUrl: "https://x/foto.jpg", announce: true, locked: false },
  rules: { welcome: { enabled: true, text: "¡Hola {nombres}!", everyMinutes: 15 }, labelOnJoin: false }, groups: [], current: null, stats: {}, createdAt: ""
} as unknown as CampaignSummary;
const REPLY: QuickReply = {
  id: "q1", shortcut: "precio", category: "Precios", useCount: 3, lastUsedAt: null, createdAt: "", updatedAt: "",
  pieces: [{ kind: "text", text: "Hola {nombre}, el plan cuesta $49.900" }, { kind: "media", media: { type: "image", url: "https://x/plan.jpg" }, caption: "{nombre}, mira" }]
};

function services() {
  const broadcasts = { list: vi.fn(async () => ({}) as never), detail: vi.fn(async () => ({}) as never), recipients: vi.fn(async () => ({}) as never), create: vi.fn(async () => ({}) as never), pause: vi.fn(async () => ({}) as never), resume: vi.fn(async () => ({}) as never), cancel: vi.fn(async () => ({}) as never) };
  const audiences = { preview: vi.fn(async () => ({}) as never) };
  const groups = {
    campaigns: { overview: vi.fn(async () => ({}) as never), detail: vi.fn(async () => ({ campaign: CAMPAIGN }) as never), create: vi.fn(async () => ({}) as never), update: vi.fn(async () => ({}) as never), setOpen: vi.fn(async () => ({}) as never) },
    groups: { list: vi.fn(async () => ({}) as never), syncNow: vi.fn(async () => ({}) as never), attach: vi.fn(async () => ({}) as never) },
    posts: { create: vi.fn(async () => ({}) as never), cancel: vi.fn(async () => []) }
  };
  const replies = { list: vi.fn(async () => [REPLY]), create: vi.fn(async () => REPLY), update: vi.fn(async () => REPLY), remove: vi.fn(async () => undefined), markUsed: vi.fn(async () => undefined) };
  const inbox = { get: vi.fn(async () => ({ id: "chat1", contactName: "Laura Gómez" }) as never), sendAgentMessage: vi.fn(async () => ({}) as never) };
  const tools = [...broadcastTools(broadcasts, audiences), ...groupTools(groups), ...quickReplyTools(replies, inbox)];
  return { broadcasts, audiences, groups, replies, inbox, tools };
}

describe("difusiones por MCP", () => {
  it("crear lleva los textos como versiones, la audiencia y solo los ajustes pedidos; el agente no es autor", async () => {
    const s = services();
    await find(s.tools, "create_broadcast").run({ name: "Promo", texts: ["Hola {first_name}", "Buenas {first_name}"], connection_ids: ["c1"], countries: ["CO"], last_inbound_days: 30, pace: "careful" }, ctx);
    expect(s.broadcasts.create).toHaveBeenCalledWith({ tenantId: T, userId: null, canManage: true }, {
      name: "Promo",
      variants: [{ kind: "message", text: "Hola {first_name}", media: null }, { kind: "message", text: "Buenas {first_name}", media: null }],
      audience: { labelIds: [], excludeLabelIds: [], countries: ["CO"], lastInboundDays: 30, excludeBoughtDays: null },
      connectionIds: ["c1"],
      scheduledAt: null,
      settings: { pace: "careful" },
      abTest: null,
      followUp: null
    });
  });

  it("textos y flujos a la vez no; un flujo sí; el segundo envío por defecto a las 48 h", async () => {
    const s = services();
    await expect(find(s.tools, "create_broadcast").run({ name: "X", texts: ["a"], flow_ids: ["f1"], connection_ids: ["c1"] }, ctx)).rejects.toThrow("textos o flujos");
    await find(s.tools, "create_broadcast").run({ name: "X", flow_ids: ["f1"], connection_ids: ["c1"], follow_up_text: "¿Pudiste verlo?" }, ctx);
    expect(s.broadcasts.create.mock.calls[0]![1]).toMatchObject({ variants: [{ kind: "flow", automationId: "f1" }], followUp: { afterHours: 48, content: { kind: "message", text: "¿Pudiste verlo?" } } });
  });

  it("calcular a cuántos les llega no envía nada; pausar, seguir y cancelar van a su acción", async () => {
    const s = services();
    await find(s.tools, "preview_broadcast_audience").run({ connection_ids: ["c1"], label_ids: ["l1"] }, ctx);
    expect(s.audiences.preview).toHaveBeenCalledWith(T, { audience: expect.objectContaining({ labelIds: ["l1"] }), connectionIds: ["c1"] });
    expect(s.broadcasts.create).not.toHaveBeenCalled();
    for (const action of ["pause", "resume", "cancel"] as const) await find(s.tools, "change_broadcast").run({ broadcast_id: "b1", action }, ctx);
    expect([s.broadcasts.pause, s.broadcasts.resume, s.broadcasts.cancel].map((fn) => fn.mock.calls[0]![1])).toEqual(["b1", "b1", "b1"]);
  });
});

describe("grupos por MCP", () => {
  it("editar una campaña cambia solo lo pedido y conserva foto, plantilla y reglas", async () => {
    const s = services();
    await find(s.tools, "update_group_campaign").run({ campaign_id: "k1", capacity: 800 }, ctx);
    expect(s.groups.campaigns.update).toHaveBeenCalledWith({ tenantId: T, canManage: true }, "k1", {
      name: "Navidad", slug: "navidad", connectionIds: ["c1"], capacity: 800,
      template: { namePattern: "Navidad", description: "Reglas del grupo", imageUrl: "https://x/foto.jpg", announce: true, locked: false },
      rules: { welcome: { enabled: true, text: "¡Hola {nombres}!", everyMinutes: 15 }, labelOnJoin: false }
    });
  });

  it("enviar: texto o encuesta, avisando a todos por defecto; sacar un grupo es campaign_id vacío", async () => {
    const s = services();
    await find(s.tools, "send_to_groups").run({ campaign_ids: ["k1"], text: "¡Cupos abiertos!" }, ctx);
    await find(s.tools, "send_to_groups").run({ group_ids: ["g1"], text: "¿Qué prefieres?", poll_options: ["A", "B"], mention_all: false }, ctx);
    expect(s.groups.posts.create.mock.calls.map((call) => call[1])).toEqual([
      { campaignIds: ["k1"], groupIds: [], content: { kind: "text", text: "¡Cupos abiertos!", mediaUrl: null, fileName: null, choices: [] }, mentionAll: true, scheduledAt: null },
      { campaignIds: [], groupIds: ["g1"], content: { kind: "poll", text: "¿Qué prefieres?", mediaUrl: null, fileName: null, choices: ["A", "B"] }, mentionAll: false, scheduledAt: null }
    ]);
    await find(s.tools, "set_group_campaign").run({ group_id: "g1" }, ctx);
    expect(s.groups.groups.attach).toHaveBeenCalledWith({ tenantId: T, canManage: true }, "g1", null);
  });
});

describe("respuestas rápidas por MCP", () => {
  it("enviar a un chat pone {nombre} como el chat de la web, manda todas las piezas en orden y la cuenta como usada", async () => {
    const s = services();
    await find(s.tools, "send_quick_reply").run({ conversation_id: "chat1", shortcut: "/Precio" }, ctx);
    expect(s.inbox.sendAgentMessage).toHaveBeenCalledWith(T, "chat1", {
      parts: [{ kind: "text", text: "Hola Laura, el plan cuesta $49.900" }, { kind: "media", media: { type: "image", url: "https://x/plan.jpg" }, caption: "Laura, mira" }]
    }, { id: `mcp:${ctx.credentialId}`, name: "Claude (agente IA)" });
    expect(s.replies.markUsed).toHaveBeenCalledWith(T, "q1");
  });

  it("editar sin textos conserva las piezas (y sus archivos); una que no existe se dice claro", async () => {
    const s = services();
    await find(s.tools, "update_quick_reply").run({ quick_reply_id: "q1", category: "Ventas" }, ctx);
    expect(s.replies.update).toHaveBeenCalledWith(T, "q1", { shortcut: "precio", category: "Ventas", pieces: REPLY.pieces });
    await expect(find(s.tools, "delete_quick_reply").run({ shortcut: "nada" }, ctx)).rejects.toThrow("no existe");
  });
});

describe("cada herramienta solo con su área", () => {
  const listed = async (permissions: Parameters<typeof requirePermissions>[0]) => {
    const access = { tenantId: T, credentialId: "c", credentialName: "x", scopes: scopesOf(requirePermissions(permissions)) };
    const result = (await new McpProtocol(services().tools, { name: "auream", version: "1" }).handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, access))?.result as { tools: Array<{ name: string }> };
    return result.tools.map((tool) => tool.name).sort();
  };

  it("ver no deja enviar ni crear; editar sí", async () => {
    expect(await listed({ broadcasts: "read" })).toEqual(["get_broadcast", "list_broadcast_recipients", "list_broadcasts"]);
    expect(await listed({ broadcasts: "write" })).toEqual(["change_broadcast", "create_broadcast", "get_broadcast", "list_broadcast_recipients", "list_broadcasts", "preview_broadcast_audience"]);
    expect(await listed({ groups: "read" })).toEqual(["get_group_campaign", "list_group_campaigns", "list_groups"]);
    expect(await listed({ groups: "write" })).toHaveLength(10);
    expect(await listed({ quick_replies: "read" })).toEqual(["list_quick_replies"]);
    expect(await listed({ quick_replies: "write" })).toEqual(["create_quick_reply", "delete_quick_reply", "list_quick_replies", "update_quick_reply"]);
    // Enviar una respuesta a un chat es responder: «Conversaciones: ver y responder».
    expect(await listed({ conversations: "write" })).toEqual(["list_quick_replies", "send_quick_reply"]);
  });
});
