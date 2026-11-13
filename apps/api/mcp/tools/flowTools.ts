import type { ApiServices } from "../../composition/composeBuilderServices";
import type { IntegrationsServices } from "../../composition/composeIntegrationsServices";
import type { FlowEditingService } from "../../../../domains/automations/editing/application/FlowEditingService";
import { BLOCK_CATALOG, findBlockRules } from "../../../../contracts/blocks/blockCatalog";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";
import { BLOCK_GUIDES, VARIABLES_NOTE } from "../blocks/blockGuides";
import type { McpTool } from "../McpTool";
import type { ProductServices } from "../../../../domains/products/application/ProductServices";
import { presentFlow } from "./flowPresenter";

// Flujos (permiso «Flujos: ver»): listarlos, leer uno con sus bloques y
// conexiones, y conocer los tipos de bloque y los recursos (IA, píxeles, productos) que
// se pueden usar al configurarlos.

export interface FlowReadServices {
  readonly builder: Pick<ApiServices, "listAutomationsService">;
  readonly editing: FlowEditingService;
  readonly integrations?: Pick<IntegrationsServices, "aiCredentials" | "pixelConnections">;
  readonly products?: Pick<ProductServices, "list">;
  /** Datos del negocio (`{g_…}`): se usan en los textos y en la regla «Variable global» del Condicional. */
  readonly business?: { list(tenantId: string): Promise<ReadonlyArray<{ key: string; label: string; type: string; value: string }>> };
}

const PALETTE = BLOCK_CATALOG.filter((block) => block.availableInPalette);

export function flowTools(services: FlowReadServices): McpTool[] {
  return [
    {
      name: "list_flows",
      title: "Listar flujos",
      description: "Los flujos de la cuenta: id, clave, nombre, estado (activo, borrador, archivado) y cuántos bloques tiene.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => {
        const { flows } = await services.builder.listAutomationsService.execute(tenantId);
        return { flows: flows.map(({ flow, graphSummary }) => ({ id: flow.id, key: flow.key, name: flow.name, status: flow.status, blocks: graphSummary.nodeCount })) };
      }
    },
    {
      name: "get_flow",
      title: "Ver un flujo",
      description:
        "Un flujo completo: cada bloque (id, tipo, nombre, configuración) con sus salidas y a qué bloque lleva cada una, y la revisión del flujo (errores y avisos, como en el editor). Acepta el id o la clave de list_flows.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { flow_id: { type: "string", description: "Id o clave del flujo (de list_flows)." } }, required: ["flow_id"] },
      run: async (args, { tenantId }) => presentFlow(await services.editing.read(tenantId, String(args["flow_id"])))
    },
    {
      name: "list_block_types",
      title: "Tipos de bloque",
      description: "Los bloques que se pueden agregar a un flujo: tipo, nombre, para qué sirve y qué salidas tiene. Usa get_block_type para ver cómo configurar uno.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async () => ({
        blockTypes: PALETTE.map((block) => ({ type: block.type, label: block.label, purpose: BLOCK_GUIDES[block.type]?.purpose ?? "", outputs: BLOCK_GUIDES[block.type]?.outputs ?? "" })),
        variables: VARIABLES_NOTE
      })
    },
    {
      name: "get_block_type",
      title: "Cómo se configura un bloque",
      description: "La configuración de un tipo de bloque: cada campo explicado, sus salidas, la configuración con la que nace y un ejemplo.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { type: { type: "string", description: "Tipo de bloque (de list_block_types), p. ej. 'menu'." } }, required: ["type"] },
      run: async (args) => {
        const rules = findBlockRules(String(args["type"]));
        const guide = rules?.availableInPalette ? BLOCK_GUIDES[rules.type] : undefined;
        if (!rules || !guide) throw new NotFoundError("Ese tipo de bloque no existe. Usa list_block_types.");
        return { type: rules.type, label: rules.label, ...guide, defaultConfig: rules.defaultConfig, variables: VARIABLES_NOTE };
      }
    },
    {
      name: "list_flow_resources",
      title: "Recursos para configurar bloques",
      description: "Las conexiones de IA (para «Extensión IA»: credentialId), los píxeles de Meta (para «Pixel»: connectionId) los productos activos (para «Registrar venta»: productId, con su precio por país) y los Datos del negocio (businessData: {g_clave} en los textos y «globalVariable» en el Condicional; los flujos no los cambian) de la cuenta. Sin claves ni tokens.",
      scope: "flows.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, { tenantId }) => ({
        aiConnections: (await services.integrations?.aiCredentials?.list.execute(tenantId) ?? []).map((item) => ({ id: item.id, name: item.name, provider: item.provider, status: item.status })),
        metaPixels: (await services.integrations?.pixelConnections?.list.execute(tenantId) ?? []).map((item) => ({ id: item.id, name: item.name, pixelId: item.pixelId, status: item.status })),
        products: services.products
          ? (await services.products.list(tenantId, false)).products
              .filter((product) => product.status === "active")
              .map((product) => ({ id: product.id, name: product.name, kind: product.kind, prices: product.prices }))
          : [],
        businessData: services.business ? (await services.business.list(tenantId)).map((datum) => ({ key: datum.key, label: datum.label, type: datum.type, value: datum.value })) : []
      })
    }
  ];
}
