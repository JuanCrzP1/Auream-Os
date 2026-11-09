import type { ConversationInbox } from "../../../../domains/conversations/application/ConversationServices";
import { CONVERSATION_FILTERS } from "../../../../contracts/ConversationContracts";
import type { McpTool } from "../McpTool";

// Conversaciones: ver los chats (`conversations.read`) y responder o enviar
// un flujo (`conversations.write`). Lo que se envía le llega al cliente por
// WhatsApp: las herramientas lo dicen para que el agente confirme antes.

type Inbox = Pick<ConversationInbox, "list" | "messages" | "sendAgentMessage" | "startFlow">;

export function conversationTools(inbox: Inbox): McpTool[] {
  return [
    {
      name: "list_conversations",
      title: "Listar chats",
      description: "Los chats de los números de WhatsApp, los más recientes primero. Filtra por estado, texto o número; `cursor` de la respuesta para ver más.",
      scope: "conversations.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          filter: { type: "string", enum: [...CONVERSATION_FILTERS], description: "Estado de los chats." },
          search: { type: "string", description: "Nombre o teléfono del cliente." },
          connection_id: { type: "string", description: "Solo los de este número (de list_connections)." },
          cursor: { type: "string", description: "Para la página siguiente (nextCursor)." }
        }
      },
      run: async (args, { tenantId }) =>
        inbox.list(tenantId, {
          ...(typeof args["filter"] === "string" ? { filter: args["filter"] as (typeof CONVERSATION_FILTERS)[number] } : {}),
          ...(typeof args["search"] === "string" ? { search: args["search"] } : {}),
          ...(typeof args["connection_id"] === "string" ? { connectionId: args["connection_id"] } : {}),
          ...(typeof args["cursor"] === "string" ? { cursor: args["cursor"] } : {})
        })
    },
    {
      name: "get_conversation_messages",
      title: "Leer un chat",
      description: "Los mensajes de un chat (del cliente, del bot y de asesores), los más recientes. `before` para ver anteriores.",
      scope: "conversations.read",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string", description: "Id del chat (de list_conversations)." },
          before: { type: "string", description: "Para ver mensajes anteriores (el cursor de la respuesta)." }
        },
        required: ["conversation_id"]
      },
      run: async (args, { tenantId }) => inbox.messages(tenantId, String(args["conversation_id"]), typeof args["before"] === "string" ? args["before"] : undefined)
    },
    {
      name: "send_message",
      title: "Responder en un chat",
      description: "Envía un mensaje de texto al cliente por WhatsApp, como asesor. El bot de ese chat queda en pausa (atiende un asesor). Confirma el texto con el usuario antes.",
      scope: "conversations.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: { conversation_id: { type: "string", description: "Id del chat." }, text: { type: "string", description: "El mensaje." } },
        required: ["conversation_id", "text"]
      },
      run: async (args, { tenantId, credentialId, credentialName }) =>
        inbox.sendAgentMessage(tenantId, String(args["conversation_id"]), args["text"], { id: `mcp:${credentialId}`, name: `${credentialName} (agente IA)` })
    },
    {
      name: "start_flow",
      title: "Enviar un flujo a un chat",
      description: "Inicia un flujo en el chat desde su comienzo (termina el que estuviera en curso). Le escribe al cliente por WhatsApp: confirma con el usuario antes.",
      scope: "conversations.write",
      readOnly: false,
      inputSchema: {
        type: "object",
        properties: { conversation_id: { type: "string", description: "Id del chat." }, flow_id: { type: "string", description: "Id del flujo (de list_flows)." } },
        required: ["conversation_id", "flow_id"]
      },
      run: async (args, { tenantId }) => inbox.startFlow(tenantId, String(args["conversation_id"]), args["flow_id"])
    }
  ];
}
