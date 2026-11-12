import type { CrmActor } from "../../../../domains/crm/application/crmViews";
import type { BoardServices } from "../../../../domains/crm/application/BoardServices";
import type { DealServices } from "../../../../domains/crm/application/DealServices";
import type { PipelineServices } from "../../../../domains/crm/application/PipelineServices";
import type { McpTool, McpToolContext } from "../McpTool";
import { defined, numberArg, requiredText, textArg } from "./toolArgs";

// ---------------------------------------------------------------------------
// CRM (área «CRM»). Ver embudos, el tablero y dónde va un cliente:
// `crm.read`. Mover de etapa y editar el negocio: `crm.write`. Mismos
// servicios que la pantalla CRM: cada etapa ES una etiqueta (mover cambia la
// etiqueta) y una venta aprobada lleva al cliente a la etapa de venta sola.
// La configuración de los embudos (crear, renombrar etapas) sigue en la web.
// ---------------------------------------------------------------------------

export interface CrmToolServices {
  readonly pipelines: Pick<PipelineServices, "list">;
  readonly board: Pick<BoardServices, "view" | "stageCards" | "move">;
  readonly deals: Pick<DealServices, "update" | "contact">;
}

function actorOf(context: McpToolContext, canWrite: boolean): CrmActor {
  return { tenantId: context.tenantId, userId: context.credentialId, canWrite, canManage: false };
}

const pipeline = { type: "string", description: "Id del embudo (de list_pipelines)." } as const;
const contact = { type: "string", description: "Id del contacto (de list_contacts o del tablero)." } as const;

export function crmTools(crm: CrmToolServices): McpTool[] {
  return [
    {
      name: "list_pipelines",
      title: "Listar embudos del CRM",
      description: "Los embudos de la cuenta con sus etapas en orden (id, nombre, etiqueta de cada etapa y cuál es la de venta o de «no compró»).",
      scope: "crm.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, context) => crm.pipelines.list(actorOf(context, false))
    },
    {
      name: "get_pipeline_board",
      title: "Ver el tablero de un embudo",
      description:
        "El tablero: cada etapa con cuántos clientes tiene, cuánto suman y sus primeros clientes (nombre, teléfono, valor, producto, responsable, hace cuánto escribió). Para ver más clientes de una etapa usa `stage_id` y `offset`. Con `search` busca por nombre o teléfono.",
      scope: "crm.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          pipeline_id: pipeline,
          search: { type: "string", description: "Nombre o teléfono." },
          stage_id: { type: "string", description: "Solo esta etapa, paginada (con `offset`)." },
          offset: { type: "integer", description: "Desde qué cliente de la etapa (el `nextOffset` anterior)." }
        },
        required: ["pipeline_id"]
      },
      run: async (args, context) => {
        const actor = actorOf(context, false);
        const filters = defined({ search: textArg(args, "search") });
        const stageId = textArg(args, "stage_id");
        return stageId
          ? crm.board.stageCards(actor, requiredText(args, "pipeline_id"), stageId, filters, numberArg(args, "offset") ?? 0)
          : crm.board.view(actor, requiredText(args, "pipeline_id"), filters);
      }
    },
    {
      name: "get_contact_crm",
      title: "Dónde va un cliente en el CRM",
      description: "En qué etapa de cada embudo está un cliente, su negocio actual (valor, producto, responsable) y sus compras anteriores.",
      scope: "crm.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { contact_id: contact }, required: ["contact_id"] },
      run: async (args, context) => crm.deals.contact(actorOf(context, false), requiredText(args, "contact_id"))
    },
    {
      name: "move_contact_stage",
      title: "Mover un cliente de etapa",
      description:
        "Pasa a un cliente a otra etapa del embudo (cambia su etiqueta de etapa). Al pasar a una etapa de «no compró» manda `reason`. Para que cuente como venta, registra la venta (record_sale o el bloque Registrar venta): moverlo a la etapa de venta no crea una venta.",
      scope: "crm.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          pipeline_id: pipeline,
          contact_id: contact,
          stage_id: { type: "string", description: "Etapa destino (de list_pipelines)." },
          reason: { type: "string", description: "Por qué no compró (solo etapas de «no compró»)." }
        },
        required: ["pipeline_id", "contact_id", "stage_id"]
      },
      run: async (args, context) => {
        await crm.board.move(actorOf(context, true), requiredText(args, "pipeline_id"), requiredText(args, "contact_id"), defined({ stageId: textArg(args, "stage_id"), reason: textArg(args, "reason") }));
        return { moved: true };
      }
    },
    {
      name: "update_deal",
      title: "Editar el negocio de un cliente",
      description: "Pone o cambia el valor esperado (monto y moneda), el producto y el responsable del negocio actual de un cliente en un embudo. Es una estimación del CRM, no una venta.",
      scope: "crm.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          pipeline_id: pipeline,
          contact_id: contact,
          amount: { type: "string", description: "Valor esperado, como lo escribe la persona («49.900»)." },
          currency: { type: "string", description: "Moneda ISO de 3 letras." },
          product_id: { type: "string", description: "Producto (de list_products)." },
          owner_id: { type: "string", description: "Responsable: el `userId` de un vendedor (de `members` en list_pipelines)." }
        },
        required: ["pipeline_id", "contact_id"]
      },
      run: async (args, context) =>
        crm.deals.update(
          actorOf(context, true),
          requiredText(args, "pipeline_id"),
          requiredText(args, "contact_id"),
          defined({ amount: textArg(args, "amount"), currency: textArg(args, "currency"), productId: textArg(args, "product_id"), ownerId: textArg(args, "owner_id") })
        )
    }
  ];
}
