import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { composeMcpServer, type McpServer } from "../../../apps/api/mcp/composeMcpServer.js";
import type { ApiConfig } from "../../../apps/api/config/loadApiConfig.js";
import { InMemoryMcpCredentialRepository } from "../../../infrastructure/persistence/memory/InMemoryMcpCredentialRepository.js";
import { InMemoryMcpOAuthRepository } from "../../../infrastructure/persistence/memory/InMemoryMcpOAuthRepository.js";
import { InMemoryContactRepository, InMemoryContactsStore, InMemoryLabelRepository } from "../../../infrastructure/persistence/memory/InMemoryContactRepositories.js";
import { CreateContactService, GetContactService, ListContactsService, UpdateContactService } from "../../../domains/contacts/application/ContactServices.js";
import { ListLabelsService } from "../../../domains/contacts/application/LabelCatalogServices.js";
import { ContactDirectoryService } from "../../../domains/contacts/application/ContactDirectoryService.js";
import { createInMemoryBuilder, type InMemoryWorkspaces } from "../../helpers/inMemoryBuilder.js";

// El servidor MCP real (credenciales, OAuth, contactos y flujos en memoria)
// y un cliente HTTP mínimo para llamar sus rutas como lo haría un agente.

export interface HttpReply {
  readonly status: number;
  readonly headers: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly json: any;
}

export interface HttpCall {
  readonly method?: string;
  readonly path: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export function createMcpServer(): { server: McpServer; oauth: InMemoryMcpOAuthRepository; credentials: InMemoryMcpCredentialRepository; workspaces: InMemoryWorkspaces } {
  const builder = createInMemoryBuilder();
  const store = new InMemoryContactsStore();
  const contacts = new InMemoryContactRepository(store);
  const labels = new InMemoryLabelRepository(store);
  const oauth = new InMemoryMcpOAuthRepository();
  const credentials = new InMemoryMcpCredentialRepository(oauth);
  const server = composeMcpServer({
    config: { whatsappWebhookBaseUrl: "https://auream-os.vercel.app/api", publicApiBaseUrl: "http://localhost:3001", publicAppOrigin: "https://auream-os.vercel.app" } as ApiConfig,
    repository: credentials,
    oauthRepository: oauth,
    builder: builder.services,
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
  return { server, oauth, credentials, workspaces: builder.workspaces };
}

/** Llama una ruta (`route(request, response, url)`) con un cuerpo JSON, de formulario (texto) o vacío. */
export async function callRoute(route: (request: IncomingMessage, response: ServerResponse, url: URL) => Promise<boolean>, call: HttpCall): Promise<HttpReply> {
  const raw = call.body === undefined ? "" : typeof call.body === "string" ? call.body : JSON.stringify(call.body);
  const contentType = typeof call.body === "string" && !call.body.startsWith("{") ? "application/x-www-form-urlencoded" : "application/json";
  const request = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method: call.method ?? "POST",
    url: call.path,
    headers: { "content-type": contentType, ...call.headers },
    socket: { remoteAddress: "10.0.0.1" }
  }) as unknown as IncomingMessage;
  const headers: Record<string, string> = {};
  const response = { statusCode: 0, body: "", setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; }, end(chunk?: string) { response.body = chunk ?? ""; } };
  await route(request, response as never, new URL(call.path, "http://x"));
  return { status: response.statusCode, headers, json: response.body ? JSON.parse(response.body) : null };
}
