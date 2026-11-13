import type { CampaignSummary, SaveCampaignRequest } from "../../../../contracts/GroupContracts";
import type { CampaignServices } from "../../../../domains/groups/application/CampaignServices";
import type { GroupServices } from "../../../../domains/groups/application/GroupServices";
import type { PostServices } from "../../../../domains/groups/application/PostServices";
import type { McpInputSchema, McpTool, McpToolContext } from "../McpTool";
import { booleanArg, numberArg, requiredText, stringListArg, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// Grupos y comunidades: campañas con un enlace único que lleva al grupo con
// cupo y crea el siguiente al llenarse; mis grupos; envíos a muchos grupos.
// Ver: «Grupos y comunidades» (`groups.read`); crear, editar, encender o
// apagar el enlace, traer grupos, sumar o sacar y enviar: «ver y editar»
// (`groups.manage`). Los mismos servicios que la pantalla. Solo números
// conectados por QR. Las fotos de un envío se suben desde la web.
// ---------------------------------------------------------------------------

export interface GroupToolServices {
  readonly campaigns: Pick<CampaignServices, "overview" | "detail" | "create" | "update" | "setOpen">;
  readonly groups: Pick<GroupServices, "list" | "syncNow" | "attach">;
  readonly posts: Pick<PostServices, "create" | "cancel">;
}

const actorOf = ({ tenantId }: McpToolContext, canManage: boolean) => ({ tenantId, canManage });

const campaignFields: McpInputSchema["properties"] = {
  name: { type: "string", description: "Nombre de la campaña («Lanzamiento Navidad»)." },
  slug: { type: "string", description: "El final del enlace público (…/g/<slug>): minúsculas, números y guiones. Vacío: sale del nombre." },
  connection_ids: { type: "array", items: { type: "string" }, description: "Números (por QR, de list_connections) que crean los grupos, por turnos." },
  capacity: { type: "integer", description: "Cupo por grupo, 20 a 1024 (por defecto 1000). Al 90 % se crea el siguiente." },
  group_name: { type: "string", description: "Nombre de cada grupo; se agrega « #1», « #2»… (hasta 21 caracteres)." },
  description: { type: "string", description: "Descripción del grupo: qué van a encontrar y sus reglas." },
  admins_only_write: { type: "boolean", description: "Solo los administradores escriben (por defecto sí: el grupo es para tus anuncios)." },
  admins_only_edit: { type: "boolean", description: "Solo los administradores cambian nombre, foto y descripción (por defecto sí)." },
  welcome_enabled: { type: "boolean", description: "Bienvenida agrupada en el grupo (por defecto sí)." },
  welcome_text: { type: "string", description: "Texto de bienvenida; {nombres} pone las menciones de los que entraron." },
  label_on_join: { type: "boolean", description: "Quien entra queda etiquetado en el CRM con el nombre de la campaña (por defecto sí)." }
};

/** La campaña con los cambios pedidos. Sobre la actual al editar (lo que no se manda queda igual). */
function campaignBody(args: ToolArgs, current: CampaignSummary | null): Partial<SaveCampaignRequest> & Record<string, unknown> {
  const pick = <T>(value: T | undefined, fallback: T | undefined) => (value !== undefined ? value : fallback);
  const template = current?.template;
  const welcome = current?.rules.welcome;
  return {
    name: pick(textArg(args, "name"), current?.name),
    slug: pick(textArg(args, "slug"), current?.slug),
    connectionIds: pick(stringListArg(args, "connection_ids"), current?.connections.map((c) => c.id)),
    capacity: pick(numberArg(args, "capacity"), current?.capacity),
    template: {
      namePattern: pick(textArg(args, "group_name"), template?.namePattern) ?? "",
      description: pick(textArg(args, "description"), template?.description) ?? "",
      imageUrl: template?.imageUrl ?? null,
      announce: pick(booleanArg(args, "admins_only_write"), template?.announce) ?? true,
      locked: pick(booleanArg(args, "admins_only_edit"), template?.locked) ?? true
    },
    rules: {
      welcome: {
        enabled: pick(booleanArg(args, "welcome_enabled"), welcome?.enabled) ?? true,
        text: pick(textArg(args, "welcome_text"), welcome?.text) ?? "",
        everyMinutes: welcome?.everyMinutes ?? 15
      },
      labelOnJoin: pick(booleanArg(args, "label_on_join"), current?.rules.labelOnJoin) ?? true
    }
  };
}

const campaignId = { campaign_id: { type: "string", description: "Id de la campaña (de list_group_campaigns)." } } as const;

export function groupTools(services: GroupToolServices): McpTool[] {
  const { campaigns, groups, posts } = services;
  return [
    {
      name: "list_group_campaigns",
      title: "Listar campañas de grupos",
      description: "Las campañas de grupos con su enlace, a qué grupo lleva ahora, sus números (clics, entraron, se quedaron, compraron, vendido) y lo de este mes.",
      scope: "groups.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, context) => campaigns.overview(actorOf(context, false))
    },
    {
      name: "get_group_campaign",
      title: "Ver una campaña de grupos",
      description: "Una campaña por dentro: su enlace, sus grupos (miembros, estado, lo vendido), lo automático, los envíos y el día a día.",
      scope: "groups.read",
      readOnly: true,
      inputSchema: { type: "object", properties: campaignId, required: ["campaign_id"] },
      run: async (args, context) => campaigns.detail(actorOf(context, false), requiredText(args, "campaign_id"))
    },
    {
      name: "list_groups",
      title: "Listar mis grupos",
      description: "Los grupos de WhatsApp de los números por QR (de campañas o sueltos), con miembros, si los administras y su campaña. Para traer los nuevos usa sync_groups.",
      scope: "groups.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, context) => groups.list(actorOf(context, false))
    },
    {
      name: "create_group_campaign",
      title: "Crear una campaña de grupos",
      description: "Crea una campaña con su enlace único; el primer grupo se crea solo en WhatsApp con el nombre, la descripción y las reglas. Confirma con la persona el nombre, los números y el cupo.",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: campaignFields, required: ["name", "connection_ids"] },
      run: async (args, context) => campaigns.create(actorOf(context, true), campaignBody(args, null))
    },
    {
      name: "update_group_campaign",
      title: "Editar una campaña de grupos",
      description: "Cambia una campaña; los cambios de nombre, descripción y reglas se llevan a todos sus grupos en WhatsApp. Lo que no mandes queda igual. Cambiar el slug cambia el enlace público: avísale a la persona.",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { ...campaignId, ...campaignFields }, required: ["campaign_id"] },
      run: async (args, context) => {
        const actor = actorOf(context, true);
        const id = requiredText(args, "campaign_id");
        const { campaign } = await campaigns.detail(actor, id);
        return campaigns.update(actor, id, campaignBody(args, campaign));
      }
    },
    {
      name: "set_group_campaign_link",
      title: "Encender o apagar el enlace",
      description: "open: el enlace vuelve a recibir gente · closed: deja de recibir (los grupos siguen igual).",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { ...campaignId, state: { type: "string", enum: ["open", "closed"], description: "Cómo dejar el enlace." } }, required: ["campaign_id", "state"] },
      run: async (args, context) => campaigns.setOpen(actorOf(context, true), requiredText(args, "campaign_id"), requiredText(args, "state") === "open")
    },
    {
      name: "sync_groups",
      title: "Traer los grupos de WhatsApp",
      description: "Lee de WhatsApp los grupos de cada número por QR y actualiza miembros y datos. Dice qué números no se pudieron revisar.",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, context) => groups.syncNow(actorOf(context, true))
    },
    {
      name: "set_group_campaign",
      title: "Sumar o sacar un grupo de una campaña",
      description: "Suma a una campaña un grupo que ya existe y administras, o lo saca (campaign_id vacío): sigue en WhatsApp, pero el enlace ya no lleva gente a él.",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { group_id: { type: "string", description: "Id del grupo (de list_groups)." }, campaign_id: { type: "string", description: "La campaña; vacío para sacarlo." } }, required: ["group_id"] },
      run: async (args, context) => groups.attach(actorOf(context, true), requiredText(args, "group_id"), textArg(args, "campaign_id") ?? null)
    },
    {
      name: "send_to_groups",
      title: "Enviar a grupos",
      description: "Envía un texto o una encuesta a campañas enteras o grupos sueltos, grupo por grupo con pausas al azar, ahora o programado. LE LLEGA A TODOS LOS MIEMBROS: confirma con la persona el mensaje y a qué grupos.",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          campaign_ids: { type: "array", items: { type: "string" }, description: "Todos los grupos de estas campañas." },
          group_ids: { type: "array", items: { type: "string" }, description: "Y/o estos grupos (de list_groups)." },
          text: { type: "string", description: "El mensaje (o la pregunta de la encuesta)." },
          poll_options: { type: "array", items: { type: "string" }, description: "Si es encuesta: 2 a 12 opciones." },
          mention_all: { type: "boolean", description: "Avisar a todos: les llega como mención aunque tengan el grupo silenciado (por defecto sí)." },
          scheduled_at: { type: "string", description: "Cuándo, ISO 8601 (vacío: ahora)." }
        },
        required: ["text"]
      },
      run: async (args, context) => {
        const choices = stringListArg(args, "poll_options") ?? [];
        return posts.create(actorOf(context, true), {
          campaignIds: stringListArg(args, "campaign_ids") ?? [],
          groupIds: stringListArg(args, "group_ids") ?? [],
          content: { kind: choices.length > 0 ? "poll" : "text", text: requiredText(args, "text"), mediaUrl: null, fileName: null, choices },
          mentionAll: booleanArg(args, "mention_all") ?? true,
          scheduledAt: textArg(args, "scheduled_at") ?? null
        });
      }
    },
    {
      name: "cancel_group_post",
      title: "Cancelar un envío a grupos",
      description: "Cancela un envío programado o lo que falta de uno en curso (lo ya enviado no se borra).",
      scope: "groups.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { post_id: { type: "string", description: "Id del envío (de get_group_campaign → posts)." } }, required: ["post_id"] },
      run: async (args, context) => ({ posts: await posts.cancel(actorOf(context, true), requiredText(args, "post_id")) })
    }
  ];
}
