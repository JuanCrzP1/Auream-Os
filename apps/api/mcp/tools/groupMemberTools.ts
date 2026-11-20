import type { GroupMemberActor, GroupMemberServices } from "../../../../domains/groups/application/GroupMemberServices";
import { GROUP_MEMBER_FILTERS } from "../../../../contracts/GroupMemberContracts";
import type { McpTool, McpToolContext } from "../McpTool";

// ---------------------------------------------------------------------------
// Los miembros de un grupo, con los MISMOS servicios y permisos que la
// pantalla: verlos pide grupos, contactos y ventas (dice quién compró);
// etiquetarlos, editar grupos y contactos. Descargarlos no está aquí: es un
// archivo para personas y queda registrado en la pantalla.
// ---------------------------------------------------------------------------

const actorOf = ({ tenantId, scopes }: McpToolContext): GroupMemberActor => ({
  tenantId,
  canSeeSales: scopes?.has("sales.read") ?? false,
  canLabel: (scopes?.has("groups.manage") ?? false) && (scopes?.has("contacts.write") ?? false),
  canExport: false
});

const groupId = { type: "string", description: "Id del grupo (de list_groups o de una campaña en get_group_campaign)." } as const;
const filter = {
  type: "string",
  enum: GROUP_MEMBER_FILTERS,
  description: "all: están en el grupo · buyers: compraron mientras estaban · nonBuyers: están y no han comprado (nunca tus números) · left: se fueron · admins: administradores."
} as const;

export function groupMemberTools(members: Pick<GroupMemberServices, "page" | "label">): McpTool[] {
  return [
    {
      name: "list_group_members",
      title: "Ver los miembros de un grupo",
      description:
        "Quién está en un grupo, quién se fue y quién compró mientras estaba (lo que compró, por moneda). Solo los que tienen número visible; `hidden` cuenta los que WhatsApp oculta. `counts` dice cuántos hay en cada filtro; `offset` (de `nextOffset`) para ver más.",
      scope: "groups.read",
      alsoRequires: ["contacts.read", "sales.read"],
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          group_id: groupId,
          filter,
          search: { type: "string", description: "Nombre o parte del número (al menos 3 dígitos)." },
          offset: { type: "integer", description: "Desde dónde seguir (el `nextOffset` de la respuesta anterior)." }
        },
        required: ["group_id"]
      },
      run: async (args, context) => members.page(actorOf(context), String(args["group_id"]), { filter: args["filter"], search: args["search"], offset: args["offset"] })
    },
    {
      name: "label_group_members",
      title: "Etiquetar a los miembros de un grupo",
      description:
        "Pone una etiqueta (se crea si no existe) a los miembros de un filtro, por ejemplo «Grupo 3 – no compró» a los que no han comprado. Nunca a tus números ni dos veces. Va por tandas: si `remaining` es mayor que 0, vuelve a llamarla igual hasta que llegue a 0. Así quedan en el CRM y en Difusiones (que envía con ritmo seguro); no escribas a cada uno por separado.",
      scope: "groups.manage",
      alsoRequires: ["contacts.write"],
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: { group_id: groupId, filter, label: { type: "string", description: "Nombre de la etiqueta, hasta 40 caracteres." } },
        required: ["group_id", "filter", "label"]
      },
      run: async (args, context) => members.label(actorOf(context), String(args["group_id"]), { filter: args["filter"], label: args["label"] })
    }
  ];
}
