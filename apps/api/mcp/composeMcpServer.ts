import { randomBytes, randomUUID } from "node:crypto";
import type { ApiConfig } from "../config/loadApiConfig";
import { publicBaseUrlOf } from "../config/publicBaseUrl";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlMcpCredentialRepository } from "../../../infrastructure/persistence/sql/SqlMcpCredentialRepository";
import { McpCredentialServices } from "../../../domains/mcp/application/McpCredentialServices";
import type { McpCredentialRepository } from "../../../domains/mcp/application/McpCredentialRepository";
import type { ApiServices } from "../composition/composeBuilderServices";
import type { ContactsServices } from "../composition/composeContactsServices";
import type { ConnectionsServices } from "../composition/composeConnectionsServices";
import type { MessagingServices } from "../composition/composeMessagingServices";
import { McpProtocol, type ToolCallReport } from "./McpProtocol";
import type { McpTool } from "./McpTool";
import type { McpAccess } from "../../../domains/mcp/domain/McpCredential";
import { flowTools } from "./tools/flowTools";
import { contactTools } from "./tools/contactTools";
import { conversationTools } from "./tools/conversationTools";
import { connectionTools } from "./tools/connectionTools";

// ---------------------------------------------------------------------------
// composeMcpServer — el servidor MCP de Auream: las credenciales (dominio
// `mcp`), las herramientas (adaptadores sobre los MISMOS servicios de la
// aplicación) y el protocolo. Agregar herramientas = un archivo en `tools/`.
// ---------------------------------------------------------------------------

export const MCP_PATH = "/mcp";

export interface McpServer {
  readonly credentials: McpCredentialServices;
  readonly protocol: McpProtocol;
  /** La dirección pública del servidor (la que se pega en el agente). */
  readonly url: string;
  readonly tools: ReadonlyArray<McpTool>;
}

export interface McpDependencies {
  readonly config: ApiConfig;
  readonly sql?: SqlClient;
  readonly repository?: McpCredentialRepository;
  readonly builder: Pick<ApiServices, "listAutomationsService" | "getWorkspaceService">;
  readonly contacts: Pick<ContactsServices, "listContacts" | "getContact" | "createContact" | "updateContact" | "listLabels" | "directory">;
  readonly connections: Pick<ConnectionsServices, "list">;
  readonly messaging: Pick<MessagingServices, "conversations"> | undefined;
  readonly onToolCall?: (access: McpAccess, report: ToolCallReport) => void;
}

export function composeMcpServer(deps: McpDependencies): McpServer {
  const credentials = new McpCredentialServices({
    repository: deps.repository ?? new SqlMcpCredentialRepository(deps.sql!),
    newId: randomUUID,
    newSecret: () => randomBytes(32).toString("base64url")
  });
  const tools: McpTool[] = [
    ...flowTools(deps.builder),
    ...contactTools(deps.contacts),
    ...(deps.messaging ? conversationTools(deps.messaging.conversations) : []),
    ...connectionTools(deps.connections)
  ];
  return {
    credentials,
    tools,
    protocol: new McpProtocol(tools, { name: "auream", version: "1.0.0" }, deps.onToolCall),
    url: `${publicBaseUrlOf(deps.config)}${MCP_PATH}`
  };
}
