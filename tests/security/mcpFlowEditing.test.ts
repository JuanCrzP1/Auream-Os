import { describe, expect, it } from "vitest";
import { routeMcp } from "../../apps/api/routes/routeMcp.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { callRoute, createMcpServer } from "./helpers/mcpServer.js";

// ---------------------------------------------------------------------------
// Un agente arma un flujo por MCP como lo haría una persona en el editor:
// crea el flujo, agrega un mensaje y un menú, conecta una opción, corrige lo
// que la revisión le señala. Con «Flujos: ver» solo puede leer. Cada cambio
// queda guardado en el borrador (lo que corre), sobre los casos de uso reales.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";

function setup() {
  const { server, workspaces } = createMcpServer();
  const limiter = new InMemoryRateLimiter();
  let id = 0;
  const call = async (token: string, name: string, args: Record<string, unknown> = {}) => {
    const reply = await callRoute((request, response, url) => routeMcp(request, response, url, server, limiter), {
      path: "/mcp",
      body: { jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } },
      headers: { authorization: `Bearer ${token}` }
    });
    return reply.json;
  };
  const result = async (token: string, name: string, args: Record<string, unknown> = {}) => (await call(token, name, args)).result.structuredContent;
  const credential = async (flows: "read" | "write") => (await server.credentials.create(T, { name: "Claude", permissions: { flows } })).token;
  return { call, result, credential, workspaces };
}

describe("editar flujos por MCP", () => {
  it("un agente con «Flujos: ver y editar» crea un flujo, agrega bloques, los conecta y deja la revisión limpia", async () => {
    const s = setup();
    const token = await s.credential("write");

    const types = await s.result(token, "list_block_types");
    expect(types.blockTypes.map((block: { type: string }) => block.type)).toEqual(["message", "question", "tags", "payment-proof", "record-sale", "condition", "distributor", "pixel", "ai", "delay", "integration", "menu", "notification"]);
    expect((await s.result(token, "get_block_type", { type: "menu" })).fields.options).toMatch(/SALIDA/);

    const flow = await s.result(token, "create_flow", { name: "Bienvenida" });
    expect([flow.name, flow.blocks.length]).toEqual(["Bienvenida", 1]);
    const start = flow.entryBlockId;

    const hello = await s.result(token, "add_block", { flow_id: flow.id, type: "message", name: "Saludo", config: { items: [{ kind: "text", text: "¡Hola {first_name}!" }] }, after_block_id: start });
    const menu = await s.result(token, "add_block", {
      flow_id: flow.id,
      type: "menu",
      config: { format: "buttons", message: "¿Qué te interesa?", options: [{ id: "precios", title: "Precios" }, { id: "asesor", title: "Asesor" }] },
      after_block_id: hello.block.id
    });
    expect(menu.block.outputs.map((output: { output: string }) => output.output)).toEqual(["precios", "asesor", "menu-other"]);

    const prices = await s.result(token, "add_block", { flow_id: flow.id, type: "message", config: { items: [{ kind: "text", text: "Nuestros precios…" }] }, after_block_id: menu.block.id, after_output: "precios" });
    const agent = await s.result(token, "add_block", { flow_id: flow.id, type: "tags", config: { tags: ["quiere-asesor"] } });
    expect(agent.review.issues).toContainEqual(expect.objectContaining({ severity: "warning", blockId: agent.block.id }));

    await s.result(token, "connect_blocks", { flow_id: flow.id, from_block_id: menu.block.id, to_block_id: agent.block.id, output: "asesor" });
    const loop = await s.result(token, "connect_blocks", { flow_id: flow.id, from_block_id: menu.block.id, to_block_id: menu.block.id, output: "menu-other" });
    expect(loop.review).toEqual({ errors: 0, warnings: 0, issues: [] });

    const full = await s.result(token, "get_flow", { flow_id: flow.id });
    expect(full.blocks.find((block: { id: string }) => block.id === prices.block.id).config.items[0].text).toBe("Nuestros precios…");
    const saved = [...s.workspaces.items.values()][0]!;
    expect(Object.keys(saved.draft.nodes)).toHaveLength(5);
  });

  it("un error de negocio vuelve como isError para que el agente corrija; con «Flujos: ver» no puede editar", async () => {
    const s = setup();
    const writer = await s.credential("write");
    const flow = await s.result(writer, "create_flow", { name: "Ventas" });
    const menu = await s.result(writer, "add_block", { flow_id: flow.id, type: "menu", config: { message: "Elige", options: [{ title: "Sí" }] }, after_block_id: flow.entryBlockId });

    const wrong = await s.call(writer, "connect_blocks", { flow_id: flow.id, from_block_id: menu.block.id, to_block_id: flow.entryBlockId, output: "menu-other" });
    expect(wrong.result).toMatchObject({ isError: true, content: [{ text: expect.stringMatching(/inicio no recibe/) }] });

    const reader = await s.credential("read");
    expect((await s.call(reader, "add_block", { flow_id: flow.id, type: "message" })).error.message).toMatch(/no tiene permiso/);
    expect((await s.result(reader, "get_flow", { flow_id: flow.id })).blocks).toHaveLength(2);
  });
});
