import { RECIPIENT_FILTERS } from "../../../../contracts/BroadcastResultsContracts";
import type { AudienceServices } from "../../../../domains/broadcasts/application/AudienceServices";
import type { BroadcastActor, BroadcastServices } from "../../../../domains/broadcasts/application/BroadcastServices";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import type { McpInputSchema, McpTool, McpToolContext } from "../McpTool";
import { booleanArg, numberArg, requiredText, stringListArg, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// Difusiones: un mensaje o un flujo a muchos clientes que YA escribieron, con
// envío seguro (pausas al azar, horario, tope diario y calentamiento por
// número, «SALIR»). Verlas: «Difusiones» (`broadcasts.read`); calcular,
// crear, pausar, seguir y cancelar: «Difusiones: ver y editar»
// (`broadcasts.manage`). Los mismos servicios y reglas que la pantalla: el
// MCP no puede saltarse el envío seguro. Las fotos o videos se adjuntan desde
// la web; por aquí van textos o flujos.
// ---------------------------------------------------------------------------

type Broadcasts = Pick<BroadcastServices, "list" | "detail" | "recipients" | "create" | "pause" | "resume" | "cancel">;
type Audiences = Pick<AudienceServices, "preview">;

/** Un agente no es una persona: la difusión queda sin autor (la web muestra «—»). */
const actorOf = ({ tenantId }: McpToolContext, canManage: boolean): BroadcastActor => ({ tenantId, userId: null, canManage });

const audienceFields: McpInputSchema["properties"] = {
  connection_ids: { type: "array", items: { type: "string" }, description: "Por qué números sale (de list_connections). A cada cliente le llega por el número en que habló." },
  label_ids: { type: "array", items: { type: "string" }, description: "Solo quien tenga alguna de estas etiquetas o etapas del CRM (de list_labels). Vacío: todos." },
  exclude_label_ids: { type: "array", items: { type: "string" }, description: "Sin quien tenga alguna de estas etiquetas." },
  countries: { type: "array", items: { type: "string" }, description: "Países por el prefijo del teléfono (ISO: CO, VE, MX…). Vacío: todos." },
  last_inbound_days: { type: "integer", description: "Solo quien escribió en los últimos N días." },
  exclude_bought_days: { type: "integer", description: "Sin quien compró en los últimos N días." }
};

const audienceOf = (args: ToolArgs) => ({
  labelIds: stringListArg(args, "label_ids") ?? [],
  excludeLabelIds: stringListArg(args, "exclude_label_ids") ?? [],
  countries: stringListArg(args, "countries") ?? [],
  lastInboundDays: numberArg(args, "last_inbound_days") ?? null,
  excludeBoughtDays: numberArg(args, "exclude_bought_days") ?? null
});

/** Lo que se envía: textos (1 a 3 versiones al azar) o flujos (1 a 3). */
function variantsOf(args: ToolArgs) {
  const texts = stringListArg(args, "texts") ?? [];
  const flows = stringListArg(args, "flow_ids") ?? [];
  if (texts.length > 0 && flows.length > 0) throw new ValidationError("Envía textos o flujos, no los dos.");
  return texts.length > 0 ? texts.map((text) => ({ kind: "message" as const, text, media: null })) : flows.map((automationId) => ({ kind: "flow" as const, automationId }));
}

function followUpOf(args: ToolArgs) {
  const text = textArg(args, "follow_up_text");
  const hours = numberArg(args, "follow_up_after_hours");
  if (!text && hours === undefined) return null;
  return { afterHours: hours ?? 48, content: { kind: "message" as const, text: text ?? "", media: null } };
}

const broadcastId = { broadcast_id: { type: "string", description: "Id de la difusión (de list_broadcasts)." } } as const;

export function broadcastTools(broadcasts: Broadcasts, audiences: Audiences): McpTool[] {
  return [
    {
      name: "list_broadcasts",
      title: "Listar difusiones",
      description: "Las difusiones de la cuenta (en curso, programadas, pausadas y terminadas) con sus resultados: enviados, leídos, respondieron, compraron y lo vendido. Incluye lo de este mes.",
      scope: "broadcasts.read",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async (_args, context) => broadcasts.list(actorOf(context, false))
    },
    {
      name: "get_broadcast",
      title: "Ver una difusión",
      description: "Una difusión por dentro: qué envía, a quién, por qué números, su avance, sus versiones y el segundo envío.",
      scope: "broadcasts.read",
      readOnly: true,
      inputSchema: { type: "object", properties: broadcastId, required: ["broadcast_id"] },
      run: async (args, context) => broadcasts.detail(actorOf(context, false), requiredText(args, "broadcast_id"))
    },
    {
      name: "list_broadcast_recipients",
      title: "A quién le llegó una difusión",
      description: "Cada persona de una difusión con su estado (entregado, leyó, respondió, compró, no quiere más, falló). Filtra por resultado; `offset` para ver más.",
      scope: "broadcasts.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: { ...broadcastId, filter: { type: "string", enum: RECIPIENT_FILTERS, description: "Qué personas (por defecto all)." }, offset: { type: "integer", description: "Desde cuál (paginación)." } },
        required: ["broadcast_id"]
      },
      run: async (args, context) => broadcasts.recipients(actorOf(context, false), requiredText(args, "broadcast_id"), textArg(args, "filter") ?? null, numberArg(args, "offset") ?? 0)
    },
    {
      name: "preview_broadcast_audience",
      title: "A cuántos les llega",
      description: "Calcula a cuántas personas les llegaría una difusión con esos filtros (sin enviar nada), cuántos pidieron no recibir más, una muestra y en cuántos días termina con el tope seguro. Úsala SIEMPRE antes de create_broadcast y muéstrale el número a la persona.",
      scope: "broadcasts.manage",
      readOnly: true,
      inputSchema: { type: "object", properties: { ...audienceFields, daily_cap: { type: "integer", description: "Máximo por número y por día (opcional)." } }, required: ["connection_ids"] },
      run: async (args, { tenantId }) =>
        audiences.preview(tenantId, { audience: audienceOf(args), connectionIds: stringListArg(args, "connection_ids") ?? [], ...(numberArg(args, "daily_cap") !== undefined ? { dailyCap: numberArg(args, "daily_cap") } : {}) })
    },
    {
      name: "create_broadcast",
      title: "Crear una difusión",
      description:
        "Envía (ahora o programada) un mensaje o un flujo a muchos clientes que ya escribieron, con envío seguro: pausas al azar, horario, tope diario y «SALIR». LE LLEGA A CLIENTES REALES POR WHATSAPP: antes usa preview_broadcast_audience y confirma con la persona el texto, a cuántos y cuándo. `{first_name}` pone el nombre de cada cliente.",
      scope: "broadcasts.manage",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre interno («Promo Black Friday»)." },
          texts: { type: "array", items: { type: "string" }, description: "El mensaje; 2 o 3 textos = versiones al azar (WhatsApp castiga mil mensajes idénticos)." },
          flow_ids: { type: "array", items: { type: "string" }, description: "O 1 a 3 flujos (de list_flows): el cliente responde y el flujo sigue." },
          ...audienceFields,
          scheduled_at: { type: "string", description: "Cuándo, ISO 8601 (vacío: ahora). Hasta 90 días." },
          pace: { type: "string", enum: ["normal", "careful"], description: "normal: 8 a 25 s entre mensajes · careful: más despacio (números nuevos)." },
          daily_cap: { type: "integer", description: "Máximo por número y por día (por defecto el seguro)." },
          from_hour: { type: "integer", description: "Hora del negocio desde la que envía (0–23, por defecto 8)." },
          to_hour: { type: "integer", description: "Hora del negocio hasta la que envía (1–24, por defecto 20)." },
          opt_out_footer: { type: "boolean", description: "Agrega «Para no recibir más mensajes, responde SALIR» (por defecto sí; recomendado)." },
          follow_up_text: { type: "string", description: "Segundo envío a quien no respondió (opcional)." },
          follow_up_after_hours: { type: "integer", description: "Horas después de terminar para el segundo envío (12 a 168, por defecto 48)." }
        },
        required: ["name", "connection_ids"]
      },
      run: async (args, context) =>
        broadcasts.create(actorOf(context, true), {
          name: requiredText(args, "name"),
          variants: variantsOf(args),
          audience: audienceOf(args),
          connectionIds: stringListArg(args, "connection_ids") ?? [],
          scheduledAt: textArg(args, "scheduled_at") ?? null,
          settings: {
            ...(textArg(args, "pace") ? { pace: textArg(args, "pace") } : {}),
            ...(numberArg(args, "daily_cap") !== undefined ? { dailyCap: numberArg(args, "daily_cap") } : {}),
            ...(numberArg(args, "from_hour") !== undefined ? { fromHour: numberArg(args, "from_hour") } : {}),
            ...(numberArg(args, "to_hour") !== undefined ? { toHour: numberArg(args, "to_hour") } : {}),
            ...(booleanArg(args, "opt_out_footer") === false ? { optOutFooter: false } : {})
          },
          abTest: null,
          followUp: followUpOf(args)
        })
    },
    {
      name: "change_broadcast",
      title: "Pausar, seguir o cancelar una difusión",
      description: "pause: deja de enviar (se puede seguir después) · resume: sigue enviando · cancel: no envía a los que faltan (no se puede deshacer). Confírmalo con la persona.",
      scope: "broadcasts.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { ...broadcastId, action: { type: "string", enum: ["pause", "resume", "cancel"], description: "Qué hacer." } }, required: ["broadcast_id", "action"] },
      run: async (args, context) => {
        const actor = actorOf(context, true);
        const id = requiredText(args, "broadcast_id");
        const action = requiredText(args, "action");
        return action === "pause" ? broadcasts.pause(actor, id) : action === "resume" ? broadcasts.resume(actor, id) : broadcasts.cancel(actor, id);
      }
    }
  ];
}
