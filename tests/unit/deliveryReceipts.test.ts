import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { parseUazapiReceipt } from "../../infrastructure/whatsapp/uazapi/parseUazapiReceipt.js";
import { routeWhatsAppWebhooks } from "../../apps/api/routes/routeWhatsAppWebhooks.js";
import type { ConnectionsServices } from "../../apps/api/composition/composeConnectionsServices.js";
import type { MessagingServices } from "../../apps/api/composition/composeMessagingServices.js";
import { ConversationInbox, ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import { RECEIPT_RETRY_MS } from "../../domains/conversations/application/ConversationRecorder.js";
import { InMemoryConversationRepository } from "../../infrastructure/persistence/memory/InMemoryConversationRepository.js";
import { ProviderWebhookKeeper } from "../../domains/connections/application/ProviderWebhookKeeper.js";
import { connectionSecretContext, type WhatsAppConnection } from "../../domains/connections/domain/WhatsAppConnection.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";

// ---------------------------------------------------------------------------
// Los chulos de la bandeja: avisos de entregado/leído de uazapi
// (`messages_update`), que solo avanzan, se reintentan si llegan antes de que
// el mensaje quede guardado, y la consulta en vivo que trae solo lo cambiado.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const TOKEN = "token-de-la-instancia";
const PHONE = "573001112233";
const base = { channel: "whatsapp", conversationKey: "c" };

/** El recibo de lectura tal como lo documenta uazapi. */
const receipt = (root: Record<string, unknown> = {}, event: Record<string, unknown> = {}) => ({
  EventType: "messages_update", owner: "573013815302", token: TOKEN, instanceName: `auream-${CONNECTION}`, type: "ReadReceipt", state: "Read",
  event: { Chat: `${PHONE}@s.whatsapp.net`, chatid: `${PHONE}@s.whatsapp.net`, Sender: `${PHONE}@s.whatsapp.net`, MessageIDs: ["3EB0A", "3EB0B"], Timestamp: 1788868800, Type: "Read", IsFromMe: true, IsGroup: false, ...event },
  ...root
});

describe("parseUazapiReceipt", () => {
  it("lee el recibo documentado; entregado y reproducido también; no depende de IsFromMe", () => {
    expect(parseUazapiReceipt(receipt())).toEqual({ ok: true, receipt: { instanceName: `auream-${CONNECTION}`, token: TOKEN, providerMessageIds: ["3EB0A", "3EB0B"], status: "read" } });
    const status = (body: Record<string, unknown>) => {
      const parsed = parseUazapiReceipt(body);
      return parsed.ok ? parsed.receipt.status : null;
    };
    expect(status(receipt({ state: "Delivered" }, { Type: "" }))).toBe("delivered");
    expect(status(receipt({ state: "" }, { Type: "Played" }))).toBe("read");
    expect(status(receipt({}, { IsFromMe: false }))).toBe("read");
  });

  it("ignora grupos, canales, estados sin uso, avisos sin ids y otros eventos", () => {
    for (const body of [
      receipt({ type: "GroupReceipts" }, { IsGroup: true }),
      receipt({}, { chatid: "120363@newsletter" }),
      receipt({ state: "Failed" }, { Type: "Failed" }),
      receipt({}, { MessageIDs: [] }),
      receipt({ EventType: "messages" }),
      receipt({ token: "" })
    ]) {
      expect(parseUazapiReceipt(body).ok).toBe(false);
    }
  });
});

describe("routeWhatsAppWebhooks · entregado/leído", () => {
  const req = (body: unknown) => Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: "POST", url: "/webhooks/uazapi", headers: {} }) as unknown as IncomingMessage;
  const recorder = () => {
    const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
    return response;
  };

  it("responde enseguida y marca los mensajes de esa conexión; con otro token no marca nada", async () => {
    const tasks: Array<() => Promise<unknown>> = [];
    const applyReceipts = vi.fn(async () => 2);
    const connections = { channel: { authenticate: vi.fn(async (_id: string, token: string) => (token === TOKEN ? { id: CONNECTION, tenantId: T } : null)) } } as unknown as ConnectionsServices;
    const messaging = { receipts: { applyReceipts } } as unknown as MessagingServices;
    const response = recorder();
    await routeWhatsAppWebhooks(req(receipt()), response as never, new URL("http://x/webhooks/uazapi"), connections, messaging, { run: (task) => tasks.push(task) });
    await routeWhatsAppWebhooks(req(receipt({ token: "falso" })), recorder() as never, new URL("http://x/webhooks/uazapi"), connections, messaging, { run: (task) => tasks.push(task) });

    expect(response.statusCode).toBe(200);
    expect(applyReceipts).not.toHaveBeenCalled();
    for (const task of tasks) await task();
    expect(applyReceipts).toHaveBeenCalledTimes(1);
    expect(applyReceipts).toHaveBeenCalledWith(T, CONNECTION, ["3EB0A", "3EB0B"], "read");
  });
});

describe("chulos y bandeja en vivo", () => {
  async function setup() {
    const repository = new InMemoryConversationRepository();
    const sleep = vi.fn(async () => undefined);
    const recorder = new ConversationRecorder(repository, () => new Date("2026-11-09T12:00:00.000Z"), sleep);
    const inbox = new ConversationInbox(repository, recorder, {} as never, {} as never, {} as never);
    const chat = await repository.findOrCreate(T, CONNECTION, PHONE, null);
    return { repository, sleep, recorder, inbox, chat };
  }

  it("solo avanzan (un aviso tardío no retrocede) y la consulta en vivo trae solo lo que cambió", async () => {
    const s = await setup();
    await s.recorder.recordOutbound(T, s.chat.id, [
      { message: { ...base, content: "Uno" }, ok: true, providerMessageId: "WA1" },
      { message: { ...base, content: "Dos" }, ok: true, providerMessageId: "WA2" }
    ], { author: "bot" });
    const first = await s.inbox.live(T, s.chat.id);
    expect(first.messages.map((m) => [m.text, m.status])).toEqual([["Uno", "sent"], ["Dos", "sent"]]);
    expect(new Date(first.messages[0]!.createdAt) < new Date(first.messages[1]!.createdAt)).toBe(true);

    expect(await s.recorder.applyReceipts(T, CONNECTION, ["WA1"], "delivered")).toBe(1);
    const delivered = await s.inbox.live(T, s.chat.id, first.cursor);
    expect(delivered.messages.map((m) => [m.text, m.status])).toEqual([["Uno", "delivered"]]);

    expect(await s.recorder.applyReceipts(T, CONNECTION, ["WA1", "WA2"], "read")).toBe(2);
    expect(await s.recorder.applyReceipts(T, CONNECTION, ["WA2"], "delivered")).toBe(0);
    const read = await s.inbox.live(T, s.chat.id, delivered.cursor);
    expect(read.messages.map((m) => [m.text, m.status])).toEqual([["Uno", "read"], ["Dos", "read"]]);
    expect((await s.inbox.live(T, s.chat.id, read.cursor)).messages).toEqual([]);
    expect(s.sleep).not.toHaveBeenCalled();
  });

  it("un aviso que llega antes de que el mensaje quede guardado se reintenta; el de otro número no marca nada", async () => {
    const s = await setup();
    // El mensaje se guarda mientras el aviso espera su reintento.
    s.sleep.mockImplementationOnce(async () => {
      await s.recorder.recordOutbound(T, s.chat.id, [{ message: { ...base, content: "Hola" }, ok: true, providerMessageId: "WA9" }], { author: "bot" });
    });
    expect(await s.recorder.applyReceipts(T, CONNECTION, ["WA9"], "delivered")).toBe(1);
    expect(s.sleep.mock.calls).toEqual([[RECEIPT_RETRY_MS[0]]]);

    s.sleep.mockClear();
    expect(await s.recorder.applyReceipts(T, OTHER, ["WA9"], "read")).toBe(0);
    expect(s.sleep.mock.calls).toEqual(RECEIPT_RETRY_MS.map((ms) => [ms]));
    expect((await s.inbox.messages(T, s.chat.id)).messages.at(-1)).toMatchObject({ text: "Hola", status: "delivered" });
  });
});

describe("ProviderWebhookKeeper", () => {
  it("pone al día los avisos del proveedor una vez por ventana, solo si está conectado, y reintenta si falla", async () => {
    const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
    const at = new Date().toISOString();
    const connection: WhatsAppConnection = {
      id: CONNECTION, tenantId: T, name: "Ventas", method: "qr", status: "connected", phoneNumber: "573013815302", profileName: null,
      providerRef: "inst", providerSecret: cipher.encrypt(TOKEN, connectionSecretContext(T, CONNECTION)), lastConnectedAt: at, createdAt: at, updatedAt: at
    };
    const refresh = vi.fn(async () => undefined);
    const clock = { ms: 0 };
    const keeper = new ProviderWebhookKeeper({ for: () => ({ refresh }) } as never, cipher, 60_000, () => clock.ms);

    await keeper.ensureCurrent(connection);
    await keeper.ensureCurrent(connection);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith({ ref: "inst", secret: TOKEN });

    clock.ms += 61_000;
    refresh.mockRejectedValueOnce(new Error("uazapi caído"));
    await expect(keeper.ensureCurrent(connection)).resolves.toBeUndefined();
    await keeper.ensureCurrent(connection);
    expect(refresh).toHaveBeenCalledTimes(3);

    await keeper.ensureCurrent({ ...connection, id: OTHER, status: "disconnected" });
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
