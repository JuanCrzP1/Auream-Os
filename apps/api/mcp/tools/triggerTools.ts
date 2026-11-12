import { CONNECTION_TRIGGER_TYPES, KEYWORD_MATCHES, type ConnectionTriggerType, type KeywordMatch, type SaveConnectionTriggerRequest } from "../../../../contracts/ConnectionTriggerContracts";
import type { ConnectionTriggerServices } from "../../../../domains/connections/application/ConnectionTriggerServices";
import type { McpTool } from "../McpTool";
import { booleanArg, defined, requiredText, stringListArg, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// Disparadores de cada número (área «Números de WhatsApp»): qué flujo arranca
// cuando alguien escribe. Ver: `connections.read`; crear, editar y quitar:
// `connections.write`. Mismo servicio y reglas que Conexiones › Disparadores
// (gana el más específico: palabra clave → anuncio → primer mensaje →
// cualquier mensaje). No conecta ni desconecta números: eso exige el QR.
// ---------------------------------------------------------------------------

type Triggers = Pick<ConnectionTriggerServices, "list" | "create" | "update" | "remove">;

const TYPE_HELP =
  "keyword (el mensaje tiene una palabra clave), ad_click (llega desde un anuncio de Meta), first_message (primer mensaje del contacto en la cuenta) o any_message (cualquier mensaje). Si el cliente ya está en un flujo y coincide otro disparador, el flujo anterior termina.";
const connection = { type: "string", description: "Id del número (de list_connections)." } as const;

function triggerInput(args: ToolArgs): Partial<SaveConnectionTriggerRequest> {
  return defined({
    type: textArg(args, "type") as ConnectionTriggerType | undefined,
    keywords: stringListArg(args, "keywords"),
    match: textArg(args, "match") as KeywordMatch | undefined,
    automationId: textArg(args, "flow_id"),
    enabled: booleanArg(args, "enabled")
  });
}

export function triggerTools(triggers: Triggers): McpTool[] {
  return [
    {
      name: "list_triggers",
      title: "Ver los disparadores de un número",
      description: "Qué flujo arranca en un número y con qué: tipo, palabras clave y cómo se comparan, flujo (id y nombre) y si está activo.",
      scope: "connections.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { connection_id: connection }, required: ["connection_id"] },
      run: async (args, { tenantId }) => ({ triggers: await triggers.list(tenantId, requiredText(args, "connection_id")) })
    },
    {
      name: "create_trigger",
      title: "Crear un disparador",
      description: `Hace que un flujo arranque en un número. Tipos: ${TYPE_HELP} Cambia lo que reciben los clientes al instante: confírmalo con la persona.`,
      scope: "connections.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          connection_id: connection,
          type: { type: "string", description: TYPE_HELP, enum: CONNECTION_TRIGGER_TYPES },
          flow_id: { type: "string", description: "Flujo que arranca (el `id` de list_flows)." },
          keywords: { type: "array", items: { type: "string" }, description: "Solo `keyword`: de 1 a 20 palabras o frases." },
          match: { type: "string", description: "Solo `keyword`: contains (contiene), exact (exacto) o starts_with (empieza con). Por defecto contains.", enum: KEYWORD_MATCHES },
          enabled: { type: "boolean", description: "Activo (por defecto sí)." }
        },
        required: ["connection_id", "type", "flow_id"]
      },
      run: async (args, { tenantId }) => triggers.create(tenantId, requiredText(args, "connection_id"), triggerInput(args))
    },
    {
      name: "update_trigger",
      title: "Editar un disparador",
      description: "Cambia el tipo, las palabras clave, cómo se comparan, el flujo o lo activa/pausa (`enabled`). Lo que no mandes queda como está.",
      scope: "connections.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: {
          connection_id: connection,
          trigger_id: { type: "string", description: "Id del disparador (de list_triggers)." },
          type: { type: "string", description: TYPE_HELP, enum: CONNECTION_TRIGGER_TYPES },
          flow_id: { type: "string", description: "Flujo que arranca." },
          keywords: { type: "array", items: { type: "string" }, description: "Solo `keyword`." },
          match: { type: "string", description: "Solo `keyword`.", enum: KEYWORD_MATCHES },
          enabled: { type: "boolean", description: "Activo o en pausa." }
        },
        required: ["connection_id", "trigger_id"]
      },
      // El servicio combina lo que llega con el disparador actual.
      run: async (args, { tenantId }) => triggers.update(tenantId, requiredText(args, "connection_id"), requiredText(args, "trigger_id"), triggerInput(args))
    },
    {
      name: "delete_trigger",
      title: "Quitar un disparador",
      description: "Quita un disparador: ese flujo deja de arrancar en el número (los clientes que ya están dentro siguen). Confírmalo con la persona.",
      scope: "connections.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: { connection_id: connection, trigger_id: { type: "string", description: "Id del disparador (de list_triggers)." } },
        required: ["connection_id", "trigger_id"]
      },
      run: async (args, { tenantId }) => {
        await triggers.remove(tenantId, requiredText(args, "connection_id"), requiredText(args, "trigger_id"));
        return { removed: true };
      }
    }
  ];
}
