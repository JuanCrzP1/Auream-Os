import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpCredentialServices } from "../../domains/mcp/application/McpCredentialServices.js";
import { SqlMcpCredentialRepository } from "../../infrastructure/persistence/sql/SqlMcpCredentialRepository.js";
import { startStack, type Stack } from "./harness/stack.js";
import { chatOf, clientWritesAndArrives, connectByQr, eventually, type Json } from "../../apps/wa-sim/demo/steps.js";

// ---------------------------------------------------------------------------
// Un agente de IA por MCP, de punta a punta: un token real de agente, el
// endpoint `POST /mcp` de verdad y el WhatsApp simulado. El agente:
//   1. ve solo las herramientas de sus áreas
//   2. guarda una respuesta rápida y se la envía a una clienta: le llega con su nombre
//   3. calcula a cuántos les llega una difusión, la crea (con envío seguro) y la cancela
//   4. crea una campaña de grupos: el primer grupo aparece en WhatsApp
// La cola de tareas no se despierta aquí (es global y la base de pruebas es
// compartida): la entrega de difusiones y envíos a grupos la cubren las
// pruebas de integración.
// ---------------------------------------------------------------------------

let stack: Stack;
let token = "";
let connectionId = "";
let instanceId = "";
const LAURA = { phone: "573009990101", name: "Laura Gómez" };

async function call<T = Json>(tool: string, args: Json = {}): Promise<T> {
  const response = await fetch(`${stack.apiBase}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method: "tools/call", params: { name: tool, arguments: args } })
  });
  const body = (await response.json()) as { result?: { content: Array<{ text: string }>; isError?: boolean }; error?: { message: string } };
  if (body.error) throw new Error(`${tool}: ${body.error.message}`);
  if (body.result?.isError) throw new Error(`${tool}: ${body.result.content[0]?.text}`);
  return JSON.parse(body.result!.content[0]!.text) as T;
}

beforeAll(async () => {
  stack = await startStack("mcp");
  const credentials = new McpCredentialServices({ repository: new SqlMcpCredentialRepository(stack.sql), newId: randomUUID, newSecret: () => randomBytes(32).toString("base64url") });
  const created = await credentials.create(stack.tenantId, {
    name: "Claude de prueba",
    permissions: { connections: "read", contacts: "read", conversations: "write", quick_replies: "write", broadcasts: "write", groups: "write" }
  });
  token = created.token;
  ({ connectionId, instanceId } = await connectByQr(stack, "Ventas", "573110000088", "Tienda MCP"));
  await clientWritesAndArrives(stack, instanceId, LAURA, "Hola, ¿cuánto cuesta?");
});
afterAll(async () => {
  await stack?.stop();
});

describe("Un agente de IA por MCP", () => {
  it("1. ve las herramientas de sus áreas y ninguna más", async () => {
    const response = await fetch(`${stack.apiBase}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    const names = ((await response.json()) as { result: { tools: Array<{ name: string }> } }).result.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["send_quick_reply", "create_quick_reply", "create_broadcast", "preview_broadcast_audience", "create_group_campaign", "send_to_groups"]));
    expect(names).not.toContain("record_sale");
    expect(names).not.toContain("update_block");
  });

  it("2. guarda una respuesta rápida y se la envía a la clienta, con su nombre", async () => {
    const saved = await call<{ id: string; shortcut: string }>("create_quick_reply", { shortcut: "Precio", category: "Ventas", texts: ["Hola {nombre} 👋", "El plan cuesta $49.900"] });
    expect(saved.shortcut).toBe("precio");
    const chats = await call<{ conversations: Json[] }>("list_conversations", { search: LAURA.phone });
    await call("send_quick_reply", { conversation_id: chats.conversations[0]!["id"], shortcut: "precio" });
    await eventually("a Laura le llegan las dos piezas", async () => {
      const texts = (await chatOf(stack, instanceId, LAURA.phone)).filter((m) => m["fromBusiness"]).map((m) => m["text"]);
      return texts.includes("Hola Laura 👋") && texts.includes("El plan cuesta $49.900");
    });
    expect((await call<{ quickReplies: Array<{ useCount: number }> }>("list_quick_replies")).quickReplies[0]!.useCount).toBe(1);
  });

  it("3. calcula a cuántos les llega, crea la difusión con envío seguro y la cancela", async () => {
    const preview = await call<{ count: number }>("preview_broadcast_audience", { connection_ids: [connectionId] });
    expect(preview.count).toBe(1);
    const created = await call<{ id: string; status: string }>("create_broadcast", { name: "Promo por agente", texts: ["Hola {first_name}, hoy 20 % de descuento"], connection_ids: [connectionId], from_hour: 0, to_hour: 24 });
    expect(["sending", "scheduled"]).toContain(created.status);
    const recipients = await call<{ recipients: Json[] }>("list_broadcast_recipients", { broadcast_id: created.id });
    expect(recipients.recipients.map((r) => r["phone"])).toEqual([LAURA.phone]);
    const detail = await call<Json>("get_broadcast", { broadcast_id: created.id });
    expect(JSON.stringify(detail)).toContain("optOutFooter\":true");
    expect((await call<{ status: string }>("change_broadcast", { broadcast_id: created.id, action: "cancel" })).status).toBe("cancelled");
  });

  it("4. crea una campaña de grupos: el primer grupo aparece en WhatsApp", async () => {
    const campaign = await call<{ id: string; link: string }>("create_group_campaign", { name: "VIP por agente", connection_ids: [connectionId], capacity: 50, group_name: "VIP agente" });
    expect(campaign.link).toContain("/g/vip-por-agente");
    const detail = await eventually("el grupo #1 queda creado", async () => {
      const found = await call<{ groups: Json[] }>("get_group_campaign", { campaign_id: campaign.id });
      return found.groups.length > 0 ? found : null;
    });
    expect(detail.groups[0]).toMatchObject({ name: "VIP agente #1", position: 1 });
    const state = await stack.phone<{ groups: Array<{ name: string }> }>("GET", "/_sim/state");
    expect(state.groups.map((g) => g.name)).toContain("VIP agente #1");
    // Editar cambia solo lo pedido (el cupo) y conserva el resto.
    const updated = await call<{ capacity: number; template: { namePattern: string } }>("update_group_campaign", { campaign_id: campaign.id, capacity: 80 });
    expect(updated).toMatchObject({ capacity: 80, template: { namePattern: "VIP agente" } });
  });
});
