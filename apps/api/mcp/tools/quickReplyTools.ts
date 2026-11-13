import { normalizeShortcut, quickReplyParts, type QuickReply, type QuickReplyPiece } from "../../../../contracts/QuickReplyContracts";
import type { ConversationInbox } from "../../../../domains/conversations/application/ConversationServices";
import type { QuickReplyServices } from "../../../../domains/quick-replies/application/QuickReplyServices";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";
import type { McpInputSchema, McpTool } from "../McpTool";
import { requiredText, stringListArg, textArg, type ToolArgs } from "./toolArgs";

// ---------------------------------------------------------------------------
// Respuestas rápidas: mensajes guardados que el equipo usa en los chats.
//   · verlas: área «Respuestas rápidas» o «Conversaciones» (`conversations.read`)
//   · organizarlas: «Respuestas rápidas: ver y editar» (`conversations.manage`,
//     como en Configuración de la web)
//   · enviarlas a un chat: «Conversaciones: ver y responder» (`conversations.write`),
//     con `{nombre}` y `{g_…}` puestos igual que en el chat de la web (`quickReplyParts`).
// Los archivos de una respuesta se suben desde la web; por aquí se escriben textos.
// ---------------------------------------------------------------------------

type Replies = Pick<QuickReplyServices, "list" | "create" | "update" | "remove" | "markUsed">;
type Inbox = Pick<ConversationInbox, "get" | "sendAgentMessage">;

const fields: McpInputSchema["properties"] = {
  shortcut: { type: "string", description: "El atajo con que el equipo la busca en el chat («/saludo»): minúsculas, números, espacios, - y _, hasta 40." },
  category: { type: "string", description: "Categoría para agruparla («Saludos», «Precios»…). Vacía = sin categoría." },
  texts: { type: "array", items: { type: "string" }, description: "Los mensajes, en orden (1 a 10). `{nombre}` se cambia por el primer nombre del cliente al enviarla." }
};

const replyRef = {
  quick_reply_id: { type: "string", description: "Id de la respuesta (de list_quick_replies)." },
  shortcut: { type: "string", description: "O su atajo, si no tienes el id." }
} as const;

/** Lo que se ve de una respuesta: sus textos y, si tiene archivos, cuáles (no se editan por aquí). */
const view = (reply: QuickReply) => ({
  id: reply.id,
  shortcut: reply.shortcut,
  category: reply.category,
  pieces: reply.pieces.map((piece) => (piece.kind === "text" ? { text: piece.text } : { file: piece.media.fileName ?? piece.media.type, caption: piece.caption ?? null })),
  useCount: reply.useCount
});

async function findReply(replies: Replies, tenantId: string, args: ToolArgs): Promise<QuickReply> {
  const id = textArg(args, "quick_reply_id");
  const shortcut = textArg(args, "shortcut");
  const all = await replies.list(tenantId);
  const found = id ? all.find((reply) => reply.id === id) : shortcut ? all.find((reply) => reply.shortcut === normalizeShortcut(shortcut)) : undefined;
  if (!found) throw new NotFoundError(id || shortcut ? "Esa respuesta rápida no existe. Búscala con list_quick_replies." : "Indica quick_reply_id o shortcut.");
  return found;
}

const textPieces = (texts: ReadonlyArray<string>): QuickReplyPiece[] => texts.map((text) => ({ kind: "text", text }));

/** Los Datos del negocio de la cuenta (`{g_…}`). */
type Business = { values(tenantId: string): Promise<Readonly<Record<string, string | number | boolean>>> };

export function quickReplyTools(replies: Replies, inbox: Inbox | null, business: Business | null = null): McpTool[] {
  const tools: McpTool[] = [
    {
      name: "list_quick_replies",
      title: "Listar respuestas rápidas",
      description: "Las respuestas rápidas de la cuenta (atajo, categoría y mensajes), las más usadas primero. `search` filtra por atajo, categoría o texto.",
      scope: "conversations.read",
      readOnly: true,
      inputSchema: { type: "object", properties: { search: { type: "string", description: "Texto a buscar (opcional)." } } },
      run: async (args, { tenantId }) => {
        const needle = normalizeShortcut(textArg(args, "search") ?? "");
        const all = (await replies.list(tenantId)).map(view);
        return { quickReplies: needle ? all.filter((reply) => normalizeShortcut(JSON.stringify([reply.shortcut, reply.category, reply.pieces])).includes(needle)) : all };
      }
    },
    {
      name: "create_quick_reply",
      title: "Crear una respuesta rápida",
      description: "Guarda una respuesta rápida de texto para el equipo. Confirma con la persona el atajo y los mensajes. Los archivos (fotos, audios…) se agregan desde la web.",
      scope: "conversations.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: fields, required: ["shortcut", "texts"] },
      run: async (args, { tenantId, credentialId }) =>
        view(await replies.create(tenantId, credentialId, { shortcut: requiredText(args, "shortcut"), category: textArg(args, "category") ?? null, pieces: textPieces(stringListArg(args, "texts") ?? []) }))
    },
    {
      name: "update_quick_reply",
      title: "Editar una respuesta rápida",
      description: "Cambia el atajo, la categoría o los mensajes. Si mandas `texts`, reemplazan TODAS las piezas (también sus archivos): si tiene archivos, avísale a la persona antes. Lo que no mandes queda igual.",
      scope: "conversations.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: { quick_reply_id: replyRef.quick_reply_id, ...fields }, required: ["quick_reply_id"] },
      run: async (args, { tenantId }) => {
        const current = await findReply(replies, tenantId, args);
        const texts = stringListArg(args, "texts");
        return view(await replies.update(tenantId, current.id, {
          shortcut: textArg(args, "shortcut") ?? current.shortcut,
          category: "category" in args ? textArg(args, "category") ?? null : current.category,
          pieces: texts ? textPieces(texts) : current.pieces
        }));
      }
    },
    {
      name: "delete_quick_reply",
      title: "Borrar una respuesta rápida",
      description: "Borra una respuesta rápida: el equipo ya no la verá en el chat. No toca mensajes ya enviados. Confírmalo con la persona.",
      scope: "conversations.manage",
      readOnly: false,
      inputSchema: { type: "object", properties: replyRef },
      run: async (args, { tenantId }) => {
        const reply = await findReply(replies, tenantId, args);
        await replies.remove(tenantId, reply.id);
        return { removed: true, shortcut: reply.shortcut };
      }
    }
  ];
  if (!inbox) return tools;
  tools.push({
    name: "send_quick_reply",
    title: "Enviar una respuesta rápida a un chat",
    description: "Envía al cliente, por WhatsApp y como asesor, todas las piezas de una respuesta rápida en orden, con `{nombre}` y los Datos del negocio (`{g_…}`) puestos. El bot de ese chat queda en pausa (atiende un asesor). Confirma con la persona antes: no se puede deshacer.",
    scope: "conversations.write",
    readOnly: false,
    inputSchema: { type: "object", properties: { conversation_id: { type: "string", description: "Id del chat (de list_conversations)." }, ...replyRef }, required: ["conversation_id"] },
    run: async (args, { tenantId, credentialId, credentialName }) => {
      const reply = await findReply(replies, tenantId, args);
      const conversationId = requiredText(args, "conversation_id");
      const chat = await inbox.get(tenantId, conversationId);
      const values = business ? await business.values(tenantId) : {};
      const sent = await inbox.sendAgentMessage(tenantId, conversationId, { parts: quickReplyParts(reply, chat.contactName, values) }, { id: `mcp:${credentialId}`, name: `${credentialName} (agente IA)` });
      await replies.markUsed(tenantId, reply.id);
      return { sent: reply.pieces.length, shortcut: reply.shortcut, conversation: sent };
    }
  });
  return tools;
}
