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
import { triggerTools } from "./tools/triggerTools";
import { productTools } from "./tools/productTools";
import { saleTools } from "./tools/saleTools";
import { crmTools, type CrmToolServices } from "./tools/crmTools";
import { analyticsTools, type DashboardToolServices } from "./tools/analyticsTools";
import type { SaleServices } from "../../../domains/sales/application/SaleServices";
import type { SalesInsights } from "../../../domains/sales/application/SalesInsights";

// ---------------------------------------------------------------------------
// composeMcpServer — el servidor MCP de Auream: las credenciales (dominio
// `mcp`), OAuth (para Claude web y escritorio), las herramientas (adaptadores
// sobre los MISMOS servicios de la aplicación) y el protocolo. Agregar
// herramientas = un archivo en `tools/` y su área de permisos en
// `contracts/McpContracts.ts` (ver docs/architecture/mcp.md).
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
  /** Ventas y catálogo (área «Ventas y productos»). */
  readonly sales?: {
    readonly products: Pick<ProductServices, "list" | "find" | "create" | "update">;
    readonly sales: Pick<SaleServices, "list" | "record" | "update">;
    readonly insights: Pick<SalesInsights, "overview">;
  };
  /** CRM: embudos, tablero y negocios (área «CRM»). */
  readonly crm?: CrmToolServices;
  /** Dashboard: ventas y ROAS, anuncios y atención (área «Dashboard y anuncios»). */
  readonly dashboard?: DashboardToolServices;
  readonly contacts: Pick<ContactsServices, "listContacts" | "getContact" | "createContact" | "updateContact" | "listLabels" | "createLabel" | "directory">;
  readonly connections: Pick<ConnectionsServices, "list" | "triggers">;
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
    ...triggerTools(deps.connections.triggers),
    ...(deps.sales ? [...productTools(deps.sales.products), ...saleTools(deps.sales.sales, deps.sales.insights)] : []),
    ...(deps.crm ? crmTools(deps.crm) : []),
    ...(deps.dashboard ? analyticsTools(deps.dashboard) : []),
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
