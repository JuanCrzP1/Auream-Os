import { describe, expect, it, vi } from "vitest";
import { McpProtocol } from "../../apps/api/mcp/McpProtocol.js";
import type { McpTool } from "../../apps/api/mcp/McpTool.js";
import type { McpAccess } from "../../domains/mcp/domain/McpCredential.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import type { Scope } from "../../platform/authorization/contracts/Scope.js";

// El protocolo MCP (JSON-RPC 2.0): negociación de versión, herramientas según
// los permisos de la credencial, validación de argumentos, errores de negocio
// como resultado (`isError`) y notificaciones sin respuesta.

const access = (scopes: Scope[]): McpAccess => ({ tenantId: "t1", credentialId: "c1", credentialName: "Claude", scopes: new Set(scopes) });
const tool = (name: string, scope: Scope, run: McpTool["run"] = async () => ({ ok: true })): McpTool => ({
  name,
  title: name,
  description: name,
  scope,
  readOnly: scope.endsWith(".read"),
  inputSchema: { type: "object", properties: { id: { type: "string", description: "id" }, page: { type: "integer", description: "página" } }, required: ["id"] },
  run
});
const call = (id: number, method: string, params?: unknown) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });

describe("McpProtocol", () => {
  it("initialize: acepta la versión del cliente si la conoce; si no, ofrece la más nueva", async () => {
    const protocol = new McpProtocol([], { name: "auream", version: "1.0.0" });
    const known = await protocol.handle(call(1, "initialize", { protocolVersion: "2025-03-26" }), access([]));
    expect(known?.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "auream" } });
    expect((await protocol.handle(call(2, "initialize", { protocolVersion: "1999-01-01" }), access([])))?.result).toMatchObject({ protocolVersion: "2025-06-18" });
    expect(await protocol.handle({ jsonrpc: "2.0", method: "notifications/initialized" }, access([]))).toBeNull();
  });

  it("tools/list muestra solo lo que la credencial permite, marcando lo que solo lee", async () => {
    const protocol = new McpProtocol([tool("list_contacts", "contacts.read"), tool("tag_contact", "contacts.write"), tool("list_flows", "flows.read")], { name: "a", version: "1" });
    const result = (await protocol.handle(call(1, "tools/list"), access(["contacts.read", "flows.read"])))?.result as { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> };
    expect(result.tools.map((item) => [item.name, item.annotations.readOnlyHint])).toEqual([["list_contacts", true], ["list_flows", true]]);
  });

  it("tools/call: sin permiso, herramienta desconocida o argumentos inválidos son errores del protocolo", async () => {
    const protocol = new McpProtocol([tool("tag_contact", "contacts.write")], { name: "a", version: "1" });
    expect((await protocol.handle(call(1, "tools/call", { name: "tag_contact", arguments: { id: "x" } }), access(["contacts.read"])))?.error?.message).toMatch(/no tiene permiso/);
    expect((await protocol.handle(call(2, "tools/call", { name: "borrar_todo" }), access(["contacts.write"])))?.error?.code).toBe(-32602);
    expect((await protocol.handle(call(3, "tools/call", { name: "tag_contact", arguments: {} }), access(["contacts.write"])))?.error?.message).toBe("Falta «id».");
    expect((await protocol.handle(call(4, "tools/call", { name: "tag_contact", arguments: { id: "x", page: 1.5 } }), access(["contacts.write"])))?.error?.message).toMatch(/integer/);
    expect((await protocol.handle(call(5, "otro/metodo"), access([])))?.error?.code).toBe(-32601);
  });

  it("tools/call: el resultado va como texto y estructurado; un error de negocio se explica (isError); uno interno, sin detalles; todo queda anotado", async () => {
    const onToolCall = vi.fn();
    const protocol = new McpProtocol(
      [
        tool("ok", "flows.read", async (args) => ({ id: args["id"], blocks: 3 })),
        tool("missing", "flows.read", async () => { throw new NotFoundError("Ese flujo no existe."); }),
        tool("boom", "flows.read", async () => { throw new Error("connection reset by peer"); })
      ],
      { name: "a", version: "1" },
      onToolCall
    );
    const scopes = access(["flows.read"]);
    expect((await protocol.handle(call(1, "tools/call", { name: "ok", arguments: { id: "f1" } }), scopes))?.result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: "f1", blocks: 3 }, null, 2) }],
      structuredContent: { id: "f1", blocks: 3 }
    });
    expect((await protocol.handle(call(2, "tools/call", { name: "missing", arguments: { id: "f1" } }), scopes))?.result).toEqual({ content: [{ type: "text", text: "Ese flujo no existe." }], isError: true });
    const internal = (await protocol.handle(call(3, "tools/call", { name: "boom", arguments: { id: "f1" } }), scopes))?.result as { content: Array<{ text: string }> };
    expect(internal.content[0]!.text).not.toContain("connection reset");
    expect(onToolCall.mock.calls.map(([, report]) => [report.tool, report.ok])).toEqual([["ok", true], ["missing", false], ["boom", false]]);
  });
});
