import { describe, expect, it } from "vitest";
import type { OutboundMessage } from "../../contracts/RuntimeContracts.js";
import type { QuickReply } from "../../contracts/QuickReplyContracts.js";
import { parseAgentReply, parseReaction, toOutbound } from "../../domains/conversations/application/AgentReply.js";
import { ConversationInbox, ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import type { SendResult } from "../../domains/conversations/application/ports/ConversationPorts.js";
import { InMemoryConversationRepository } from "../../infrastructure/persistence/memory/InMemoryConversationRepository.js";
import { QuickReplyServices } from "../../domains/quick-replies/application/QuickReplyServices.js";
import type { NewQuickReply, QuickReplyRepository } from "../../domains/quick-replies/application/QuickReplyRepository.js";

// ---------------------------------------------------------------------------
// Herramientas del chat (fase 1): lo que envía el asesor (piezas, nota de voz,
// cita), reacciones, eliminar un chat y el catálogo de respuestas rápidas.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const agent = { id: "u1", name: "Camilo" };

function setup() {
  const repository = new InMemoryConversationRepository();
  const recorder = new ConversationRecorder(repository);
  const outbox: OutboundMessage[][] = [];
  let next = 0;
  const sender = {
    deliver: async (_t: string, _c: string, _p: string, messages: ReadonlyArray<OutboundMessage>) => {
      outbox.push([...messages]);
      const results: SendResult[] = messages.map((message) => ({ message, ok: true, ...(message.kind === "reaction" ? {} : { providerMessageId: `wa-out-${++next}` }) }));
      return { results };
    }
  };
  const inbox = new ConversationInbox(repository, recorder, sender, { launch: async () => ({ flowName: "", sent: 0, failed: 0 }) }, { setLabels: async () => undefined });
  return { repository, recorder, inbox, outbox };
}

async function chatWithClientMessage(s: ReturnType<typeof setup>) {
  return s.recorder.recordInbound(
    T,
    { connectionId: "w1", phone: "573001112233", kind: "text", text: "¿Precio?", media: null, providerMessageId: "wa-in-1", sentAt: new Date().toISOString() } as never,
    null
  );
}

describe("lo que envía el asesor", () => {
  it("acepta un texto suelto o varias piezas en orden; la cita va solo en la primera", () => {
    expect(parseAgentReply("  Hola ")).toEqual({ parts: [{ kind: "text", text: "Hola" }] });
    const reply = parseAgentReply({
      parts: [
        { kind: "media", media: { type: "audio", url: "https://blob.test/n.ogg", voice: true } },
        { kind: "text", text: "Escúchalo" }
      ],
      replyToId: "m1"
    });
    const outbound = toOutbound(reply.parts, "c1", "wa-in-1");
    expect(outbound[0]).toMatchObject({ kind: "media", media: { type: "audio", voice: true }, replyToMessageId: "wa-in-1" });
    expect(outbound[1]).toEqual({ channel: "whatsapp", conversationKey: "c1", content: "Escúchalo" });
  });

  it("rechaza lo vacío, enlaces que no son https y reacciones que no son emoji", () => {
    expect(() => parseAgentReply({ parts: [{ kind: "text", text: "  " }] })).toThrow(/Escribe un mensaje/);
    expect(() => parseAgentReply({ parts: [{ kind: "media", media: { type: "image", url: "javascript:alert(1)" } }] })).toThrow(/enlace válido/);
    expect(() => parseReaction("hola")).toThrow(/emoji/);
    expect(parseReaction("❤️")).toBe("❤️");
    expect(parseReaction("")).toBe("");
  });
});

describe("la bandeja con citas, reacciones y eliminar", () => {
  it("responder citando un mensaje lo cita en WhatsApp y en el hilo, y pausa el bot", async () => {
    const s = setup();
    const chat = await chatWithClientMessage(s);
    const quoted = s.repository.stored[0]!;
    const summary = await s.inbox.sendAgentMessage(T, chat.id, { parts: [{ kind: "text", text: "Son 50 mil" }], replyToId: quoted.id }, agent);

    expect(s.outbox[0]![0]).toMatchObject({ content: "Son 50 mil", replyToMessageId: "wa-in-1" });
    const { messages } = await s.inbox.messages(T, chat.id);
    expect(messages.at(-1)!.replyTo).toEqual({ id: quoted.id, author: "contact", kind: "text", text: "¿Precio?" });
    expect(summary.botEnabled).toBe(false);
  });

  it("no cita mensajes de otro chat", async () => {
    const s = setup();
    const chat = await chatWithClientMessage(s);
    await expect(s.inbox.sendAgentMessage(T, chat.id, { text: "Hola", replyToId: "otro" }, agent)).rejects.toThrow(/ya no está/);
  });

  it("reaccionar sale como reacción al mensaje de WhatsApp y queda apuntando a él, sin pausar el bot", async () => {
    const s = setup();
    const chat = await chatWithClientMessage(s);
    const target = s.repository.stored[0]!;
    await s.inbox.react(T, chat.id, target.id, "👍", agent);

    expect(s.outbox[0]![0]).toMatchObject({ kind: "reaction", content: "👍", replyToMessageId: "wa-in-1" });
    expect(s.repository.stored.at(-1)).toMatchObject({ kind: "reaction", text: "👍", replyToId: target.id });
    expect((await s.inbox.get(T, chat.id)).botEnabled).toBe(true);
  });

  it("eliminar borra el chat y su historial", async () => {
    const s = setup();
    const chat = await chatWithClientMessage(s);
    await s.inbox.remove(T, chat.id);
    await expect(s.inbox.get(T, chat.id)).rejects.toThrow(/no encontrada/);
    expect(s.repository.stored).toHaveLength(0);
    await expect(s.inbox.remove(T, chat.id)).rejects.toThrow(/no encontrada/);
  });
});

class MemoryQuickReplies implements QuickReplyRepository {
  public readonly rows: QuickReply[] = [];
  public async list() {
    return [...this.rows];
  }
  public async count() {
    return this.rows.length;
  }
  public async findByShortcut(_t: string, shortcut: string) {
    return this.rows.find((row) => row.shortcut === shortcut) ?? null;
  }
  public async create(reply: NewQuickReply) {
    const row: QuickReply = { id: reply.id, shortcut: reply.shortcut, pieces: reply.pieces, useCount: 0, lastUsedAt: null, createdAt: "", updatedAt: "" };
    this.rows.push(row);
    return row;
  }
  public async update(_t: string, id: string, changes: Pick<QuickReply, "shortcut" | "pieces">) {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = { ...this.rows[index]!, ...changes };
    return this.rows[index]!;
  }
  public async remove(_t: string, id: string) {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index >= 0) this.rows.splice(index, 1);
    return index >= 0;
  }
  public async markUsed() {}
}

describe("respuestas rápidas", () => {
  it("normaliza el atajo, guarda las piezas y no repite atajos", async () => {
    const services = new QuickReplyServices(new MemoryQuickReplies());
    const created = await services.create(T, "u1", { shortcut: " /Saludo Inicial ", pieces: [{ kind: "text", text: " Hola {nombre} " }] });
    expect(created.shortcut).toBe("saludo inicial");
    expect(created.pieces).toEqual([{ kind: "text", text: "Hola {nombre}" }]);
    await expect(services.create(T, "u1", { shortcut: "saludo inicial", pieces: [{ kind: "text", text: "x" }] })).rejects.toThrow(/Ya tienes/);
    await expect(services.update(T, created.id, { shortcut: "saludo inicial", pieces: [{ kind: "text", text: "Otra" }] })).resolves.toMatchObject({ pieces: [{ kind: "text", text: "Otra" }] });
  });

  it("valida atajo y piezas", async () => {
    const services = new QuickReplyServices(new MemoryQuickReplies());
    await expect(services.create(T, "u1", { shortcut: "hola!", pieces: [{ kind: "text", text: "x" }] })).rejects.toThrow(/atajo admite/);
    await expect(services.create(T, "u1", { shortcut: "precios", pieces: [] })).rejects.toThrow(/al menos/);
    await expect(services.create(T, "u1", { shortcut: "precios", pieces: [{ kind: "media", media: { type: "file", url: "" } }] })).rejects.toThrow(/no tiene archivo/);
    await expect(services.remove(T, "no-es-un-id")).rejects.toThrow(/ya no existe/);
  });
});
