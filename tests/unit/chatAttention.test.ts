import { describe, expect, it } from "vitest";
import type { OutboundMessage } from "../../contracts/RuntimeContracts.js";
import { ChatAttention } from "../../domains/conversations/application/ChatAttention.js";
import { ConversationInbox, ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import { NewChatService } from "../../domains/conversations/application/NewChatService.js";
import { ContactNoteServices, type ContactNoteRepository, type StoredContactNote } from "../../domains/contacts/application/ContactNoteServices.js";
import { statusAfterInbound, statusForAssignee, statusForBot } from "../../domains/conversations/domain/ChatStatus.js";
import { InMemoryConversationRepository } from "../../infrastructure/persistence/memory/InMemoryConversationRepository.js";

// ---------------------------------------------------------------------------
// Chats, fase 2: estados (con bot, en espera, en atención, resuelto), tomar,
// pasar y resolver (con el responsable del CRM), «Sin responder», «Mis
// chats», chat nuevo y notas internas.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";
const ANA = "33333333-3333-4333-8333-333333333333";
const AGENTS = [{ userId: ME, name: "Camilo", photoUrl: null }, { userId: ANA, name: "Ana", photoUrl: null }];

function setup() {
  const repository = new InMemoryConversationRepository();
  const recorder = new ConversationRecorder(repository);
  const sender = { deliver: async (_t: string, _c: string, _p: string, messages: ReadonlyArray<OutboundMessage>) => ({ results: messages.map((message) => ({ message, ok: true, providerMessageId: "wa" })) }) };
  const flows: string[] = [];
  const inbox = new ConversationInbox(repository, recorder, sender, { launch: async (_t, _c, id) => (flows.push(id), { flowName: "Ventas", sent: 1, failed: 0 }) }, { setLabels: async () => undefined });
  const claims: Array<[string, string]> = [];
  const attention = new ChatAttention(repository, { agents: async () => AGENTS }, { claimUnowned: async (_t, contactId, ownerId) => void claims.push([contactId, ownerId]) });
  return { repository, recorder, inbox, attention, claims, flows };
}

const inbound = (s: ReturnType<typeof setup>, text = "Hola") =>
  s.recorder.recordInbound(T, { connectionId: "w1", phone: "573001112233", kind: "text", text, media: null, providerMessageId: null, sentAt: new Date().toISOString() } as never, "k1");

describe("estados del chat", () => {
  it("siguen las reglas: bot, en espera, en atención y reabrir al escribir", () => {
    expect(statusForBot(true, ME)).toBe("bot");
    expect(statusForBot(false, null)).toBe("waiting");
    expect(statusForBot(false, ME)).toBe("attending");
    expect(statusForAssignee(null)).toBe("waiting");
    expect(statusAfterInbound("resolved", true, ME)).toBe("bot");
    expect(statusAfterInbound("attending", false, ME)).toBe("attending");
  });
});

describe("atención", () => {
  it("responder toma el chat: en atención, a nombre de quien respondió, y el cliente ya no espera", async () => {
    const s = setup();
    const chat = await inbound(s);
    expect((await s.inbox.list(T, { filter: "unanswered" })).conversations).toHaveLength(1);
    const after = await s.inbox.sendAgentMessage(T, chat.id, "Te ayudo", { id: ME, name: null });
    expect(after).toMatchObject({ status: "attending", assigneeId: ME, botEnabled: false, awaitingSince: null });
    expect((await s.inbox.list(T, { filter: "mine" }, ME)).conversations).toHaveLength(1);
    expect((await s.inbox.list(T, { filter: "mine" }, ANA)).conversations).toHaveLength(0);
  });

  it("tomar, pasar (el CRM recibe el responsable), dejar sin asignar y resolver; si el cliente escribe, se reabre con el bot", async () => {
    const s = setup();
    const chat = await inbound(s);
    expect(await s.attention.take(T, chat.id, ME)).toMatchObject({ status: "attending", assigneeId: ME, botEnabled: false });
    expect(await s.attention.assign(T, chat.id, ANA, ME)).toMatchObject({ assigneeId: ANA });
    expect(s.claims).toEqual([["k1", ME], ["k1", ANA]]);
    await expect(s.attention.assign(T, chat.id, "otra-persona", ME)).rejects.toThrow(/no está en el equipo/);
    expect(await s.attention.assign(T, chat.id, null, ME)).toMatchObject({ status: "waiting", assigneeId: null });

    expect(await s.attention.resolve(T, chat.id)).toMatchObject({ status: "resolved", botEnabled: true });
    const list = await s.inbox.list(T, { status: "resolved" });
    expect(list.counts).toMatchObject({ resolved: 1 });
    await inbound(s, "Otra pregunta");
    expect(await s.inbox.get(T, chat.id)).toMatchObject({ status: "bot", awaitingSince: expect.any(String) });
  });
});

describe("chat nuevo", () => {
  it("desde un número conectado: crea el contacto, abre el chat y envía el primer mensaje o un flujo", async () => {
    const s = setup();
    const identified: string[] = [];
    const service = new NewChatService(
      { isConnected: async (_t, id) => id === "w1" },
      { identify: async (_t, phone) => (identified.push(phone), { contactId: "k9" }) },
      s.recorder,
      s.inbox
    );
    const chat = await service.start(T, { connectionId: "w1", phone: "+57 300 999 8877", message: { text: "Hola" } }, { id: ME, name: null });
    expect(identified).toEqual(["573009998877"]);
    expect(chat).toMatchObject({ phone: "573009998877", status: "attending", assigneeId: ME });

    await service.start(T, { connectionId: "w1", phone: "573004445566", automationId: "f1" }, { id: ME, name: null });
    expect(s.flows).toEqual(["f1"]);
    await expect(service.start(T, { connectionId: "w2", phone: "573004445566", message: { text: "Hola" } }, { id: ME, name: null })).rejects.toThrow(/no está conectado/);
    await expect(service.start(T, { connectionId: "w1", phone: "12", message: { text: "Hola" } }, { id: ME, name: null })).rejects.toThrow(/número completo/);
    await expect(service.start(T, { connectionId: "w1", phone: "573004445566", message: { text: " " } }, { id: ME, name: null })).rejects.toThrow(/Escribe un mensaje/);
  });
});

class MemoryNotes implements ContactNoteRepository {
  public rows: Array<StoredContactNote & { contactId: string }> = [];
  public async list(_t: string, contactId: string) {
    return this.rows.filter((row) => row.contactId === contactId);
  }
  public async add(note: { id: string; contactId: string; body: string; authorId: string }) {
    if (note.contactId !== "44444444-4444-4444-8444-444444444444") return null;
    const row = { id: note.id, contactId: note.contactId, body: note.body, authorId: note.authorId, authorName: "Camilo", createdAt: "" };
    this.rows.unshift(row);
    return row;
  }
  public async find(_t: string, _c: string, id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }
  public async remove(_t: string, _c: string, id: string) {
    this.rows = this.rows.filter((row) => row.id !== id);
  }
}

describe("notas internas", () => {
  it("se anotan; las borra su autor o un dueño o administrador", async () => {
    const K = "44444444-4444-4444-8444-444444444444";
    const notes = new ContactNoteServices(new MemoryNotes());
    const note = await notes.add(T, K, "  Pagó la mitad  ", { userId: ME, canManage: false });
    expect(note).toMatchObject({ body: "Pagó la mitad", canDelete: true });
    await expect(notes.add(T, K, " ", { userId: ME, canManage: false })).rejects.toThrow(/Escribe la nota/);
    await expect(notes.add(T, "55555555-5555-4555-8555-555555555555", "x", { userId: ME, canManage: false })).rejects.toThrow(/no existe/);
    expect((await notes.list(T, K, { userId: ANA, canManage: false }))[0]!.canDelete).toBe(false);
    await expect(notes.remove(T, K, note.id, { userId: ANA, canManage: false })).rejects.toThrow(/Solo quien escribió/);
    await notes.remove(T, K, note.id, { userId: ANA, canManage: true });
    expect(await notes.list(T, K, { userId: ME, canManage: false })).toHaveLength(0);
  });
});
