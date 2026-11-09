import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeMcp } from "../../apps/api/routes/routeMcp.js";
import { composeMcpServer } from "../../apps/api/mcp/composeMcpServer.js";
import type { ApiConfig } from "../../apps/api/config/loadApiConfig.js";
import { InMemoryMcpCredentialRepository } from "../../infrastructure/persistence/memory/InMemoryMcpCredentialRepository.js";
import { InMemoryContactRepository, InMemoryContactsStore, InMemoryLabelRepository } from "../../infrastructure/persistence/memory/InMemoryContactRepositories.js";
import { CreateContactService, GetContactService, ListContactsService, UpdateContactService } from "../../domains/contacts/application/ContactServices.js";
import { ListLabelsService } from "../../domains/contacts/application/LabelCatalogServices.js";
import { ContactDirectoryService } from "../../domains/contacts/application/ContactDirectoryService.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { TooManyRequestsError } from "../../platform/observability/errors/TooManyRequestsError.js";

// ---------------------------------------------------------------------------
// `POST /mcp` como lo usa un agente (Claude, n8n, Cursor): sin token válido
// 401; con token, el protocolo y solo las herramientas que su credencial
// permite, sobre los servicios reales (contactos en memoria). La cuenta sale
// de la credencial: un agente nunca ve otra cuenta.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";

async function setup() {
  const store = new InMemoryContactsStore();
  const contacts = new InMemoryContactRepository(store);
  const labels = new InMemoryLabelRepository(store);
  const server = composeMcpServer({
    config: { whatsappWebhookBaseUrl: "https://auream-os.vercel.app/api", publicApiBaseUrl: "http://localhost:3001" } as ApiConfig,
    repository: new InMemoryMcpCredentialRepository(),
    builder: { listAutomationsService: { execute: async () => ({ flows: [], folders: [] }) }, getWorkspaceService: { execute: async () => null } } as never,
    contacts: {
      listContacts: new ListContactsService(contacts),
      getContact: new GetContactService(contacts),
      createContact: new CreateContactService(contacts),
      updateContact: new UpdateContactService(contacts),
      listLabels: new ListLabelsService(labels),
      directory: new ContactDirectoryService(contacts, labels)
    },
    connections: { list: { execute: async () => [] } } as never,
    messaging: undefined
  });
  const limiter = new InMemoryRateLimiter();
  const post = async (body: unknown, token?: string, method = "POST") => {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    const request = Object.assign(Readable.from([Buffer.from(raw)]), { method, url: "/mcp", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) } }) as unknown as IncomingMessage;
    const headers: Record<string, string> = {};
    const response = { statusCode: 0, body: "", setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; }, end(chunk?: string) { response.body = chunk ?? ""; } };
    await routeMcp(request, response as never, new URL("http://x/mcp"), server, limiter);
    return { status: response.statusCode, headers, json: response.body ? JSON.parse(response.body) : null };
  };
  const credential = async (permissions: Record<string, string>) => (await server.credentials.create(T, { name: "Claude", permissions })).token;
  return { server, post, credential };
}

const rpc = (id: number, method: string, params?: unknown) => ({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
const toolResult = (reply: { json: { result: { structuredContent: unknown } } }) => reply.json.result.structuredContent;

describe("routeMcp", () => {
  it("sin token válido: 401 con WWW-Authenticate; GET: 405; la dirección pública del servidor", async () => {
    const s = await setup();
    const denied = await s.post(rpc(1, "tools/list"));
    expect([denied.status, denied.headers["www-authenticate"]]).toEqual([401, 'Bearer realm="auream-mcp"']);
    expect((await s.post(rpc(1, "tools/list"), "aur_mcp_inventado")).status).toBe(401);
    expect((await s.post("", await s.credential({ contacts: "read" }), "GET")).status).toBe(405);
    expect(s.server.url).toBe("https://auream-os.vercel.app/api/mcp");
  });

  it("un agente con «Contactos: ver y editar» crea, busca y etiqueta contactos en SU cuenta", async () => {
    const s = await setup();
    const token = await s.credential({ contacts: "write" });
    expect((await s.post(rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude", version: "1" } }), token)).json.result.serverInfo.name).toBe("auream");
    expect((await s.post({ jsonrpc: "2.0", method: "notifications/initialized" }, token)).status).toBe(202);

    const tools = (await s.post(rpc(2, "tools/list"), token)).json.result.tools.map((tool: { name: string }) => tool.name);
    expect(tools).toEqual(["list_contacts", "get_contact", "list_labels", "create_contact", "update_contact", "tag_contact"]);

    const created = toolResult(await s.post(rpc(3, "tools/call", { name: "create_contact", arguments: { phone: "573001234567", name: "Laura" } }), token)) as { id: string };
    await s.post(rpc(4, "tools/call", { name: "tag_contact", arguments: { contact_id: created.id, add: ["VIP"] } }), token);
    await s.post(rpc(5, "tools/call", { name: "update_contact", arguments: { contact_id: created.id, fields: { ciudad: "Bogotá" } } }), token);
    const found = toolResult(await s.post(rpc(6, "tools/call", { name: "list_contacts", arguments: { label: "vip" } }), token)) as { contacts: Array<{ name: string; customFields: object; labels: Array<{ name: string }> }> };
    expect(found.contacts.map((contact) => [contact.name, contact.customFields, contact.labels.map((label) => label.name)])).toEqual([["Laura", { ciudad: "Bogotá" }, ["VIP"]]]);
  });

  it("con «Contactos: ver» no puede editar; un error de negocio vuelve como isError", async () => {
    const s = await setup();
    const token = await s.credential({ contacts: "read" });
    expect((await s.post(rpc(1, "tools/call", { name: "create_contact", arguments: { phone: "573001234567" } }), token)).json.error.message).toMatch(/no tiene permiso/);
    const missing = await s.post(rpc(2, "tools/call", { name: "get_contact", arguments: { contact_id: "no-existe" } }), token);
    expect(missing.json.result).toMatchObject({ isError: true });
  });

  it("JSON inválido: -32700; varios mensajes a la vez reciben sus respuestas; más de 300 por minuto: 429", async () => {
    const s = await setup();
    const token = await s.credential({ contacts: "read" });
    const broken = await s.post("{no es json", token);
    expect([broken.status, broken.json.error.code]).toEqual([400, -32700]);
    const batch = await s.post([rpc(1, "ping"), { jsonrpc: "2.0", method: "notifications/initialized" }, rpc(2, "ping")], token);
    expect(batch.json.map((reply: { id: number }) => reply.id)).toEqual([1, 2]);
    // 1 + 1 ya hechas + 298 = 300: la 301 se rechaza.
    for (let i = 0; i < 298; i += 1) await s.post(rpc(i, "ping"), token);
    await expect(s.post(rpc(999, "ping"), token)).rejects.toBeInstanceOf(TooManyRequestsError);
  });
});
