import type { HelpServices } from "../../../domains/help/application/HelpServices";
import { helpTools } from "./tools/helpTools";
import type { ProductServices } from "../../../domains/products/application/ProductServices";
import { randomBytes, randomUUID } from "node:crypto";
import type { ApiConfig } from "../config/loadApiConfig";
import { publicBaseUrlOf } from "../config/publicBaseUrl";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlMcpCredentialRepository } from "../../../infrastructure/persistence/sql/SqlMcpCredentialRepository";
import { SqlMcpOAuthRepository } from "../../../infrastructure/persistence/sql/SqlMcpOAuthRepository";
import { McpCredentialServices } from "../../../domains/mcp/application/McpCredentialServices";
import { McpOAuthServices } from "../../../domains/mcp/application/McpOAuthServices";
import type { McpCredentialRepository } from "../../../domains/mcp/application/McpCredentialRepository";
import type { McpOAuthRepository } from "../../../domains/mcp/application/McpOAuthRepository";
import type { ContactsServices } from "../composition/composeContactsServices";
import type { ConnectionsServices } from "../composition/composeConnectionsServices";
import type { MessagingServices } from "../composition/composeMessagingServices";
import { McpProtocol, type ToolCallReport } from "./McpProtocol";
import type { OAuthAddresses } from "./oauthMetadata";
import type { McpTool } from "./McpTool";
import type { McpAccess } from "../../../domains/mcp/domain/McpCredential";
import { flowTools } from "./tools/flowTools";
import { flowEditTools } from "./tools/flowEditTools";
import { composeFlowEditingService, type FlowEditingBuilderServices } from "../composition/composeFlowEditingService";
import type { IntegrationsServices } from "../composition/composeIntegrationsServices";
import { contactTools } from "./tools/contactTools";
import { conversationTools } from "./tools/conversationTools";
import { connectionTools } from "./tools/connectionTools";

// ---------------------------------------------------------------------------
// composeMcpServer — el servidor MCP de Auream: las credenciales (dominio
// `mcp`), OAuth (para Claude web y escritorio), las herramientas (adaptadores
// sobre los MISMOS servicios de la aplicación) y el protocolo. Agregar
// herramientas = un archivo en `tools/`.
// ---------------------------------------------------------------------------

export const MCP_PATH = "/mcp";

export interface McpServer {
  readonly credentials: McpCredentialServices;
  readonly oauth: McpOAuthServices;
  /** Direcciones públicas para el descubrimiento OAuth. */
  readonly addresses: OAuthAddresses;
  readonly protocol: McpProtocol;
  /** La dirección pública del servidor (la que se pega en el agente). */
  readonly url: string;
  readonly tools: ReadonlyArray<McpTool>;
}

export interface McpDependencies {
  readonly config: ApiConfig;
  readonly sql?: SqlClient;
  readonly repository?: McpCredentialRepository;
  readonly oauthRepository?: McpOAuthRepository;
  readonly builder: FlowEditingBuilderServices;
  /** Conexiones de IA y píxeles (para configurar esos bloques). */
  readonly integrations?: Pick<IntegrationsServices, "aiCredentials" | "pixelConnections">;
  /** Catálogo de productos (para configurar Registrar venta). */
  readonly products?: Pick<ProductServices, "list">;
  readonly contacts: Pick<ContactsServices, "listContacts" | "getContact" | "createContact" | "updateContact" | "listLabels" | "directory">;
  readonly connections: Pick<ConnectionsServices, "list">;
  readonly messaging: Pick<MessagingServices, "conversations"> | undefined;
  /** La documentación de Auream (guía para agentes, buscar y leer artículos). */
  readonly help?: Pick<HelpServices, "documents" | "search">;
  readonly onToolCall?: (access: McpAccess, report: ToolCallReport) => void;
}

export function composeMcpServer(deps: McpDependencies): McpServer {
  const newSecret = () => randomBytes(32).toString("base64url");
  const apiBaseUrl = publicBaseUrlOf(deps.config);
  const addresses: OAuthAddresses = { issuer: deps.config.publicAppOrigin, apiBaseUrl, resource: `${apiBaseUrl}${MCP_PATH}` };
  const credentials = new McpCredentialServices({ repository: deps.repository ?? new SqlMcpCredentialRepository(deps.sql!), newId: randomUUID, newSecret });
  const oauth = new McpOAuthServices({
    repository: deps.oauthRepository ?? new SqlMcpOAuthRepository(deps.sql!),
    credentials,
    resourceUrl: addresses.resource,
    newId: randomUUID,
    newSecret
  });
  const editing = composeFlowEditingService(deps.builder);
  const tools: McpTool[] = [
    ...flowTools({
      builder: deps.builder,
      editing,
      ...(deps.integrations ? { integrations: deps.integrations } : {}),
      ...(deps.products ? { products: deps.products } : {})
    }),
    ...flowEditTools(editing),
    ...contactTools(deps.contacts),
    ...(deps.messaging ? conversationTools(deps.messaging.conversations) : []),
    ...connectionTools(deps.connections),
    ...(deps.help ? helpTools(deps.help) : [])
  ];
  return {
    credentials,
    oauth,
    addresses,
    tools,
    protocol: new McpProtocol(tools, { name: "auream", version: "1.0.0" }, deps.onToolCall),
    url: addresses.resource
  };
}
