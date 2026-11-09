import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { parseUazapiMessage } from "../../infrastructure/whatsapp/uazapi/parseUazapiMessage.js";
import { UazapiMessenger } from "../../infrastructure/whatsapp/uazapi/UazapiMessenger.js";
import { UazapiClient, type FetchLike } from "../../infrastructure/whatsapp/uazapi/UazapiClient.js";
import { ConnectionChannelServices, MAX_INLINE_PAUSE_MS } from "../../domains/connections/application/ConnectionChannelServices.js";
import { MessengerError, type WhatsAppMessenger } from "../../domains/connections/application/ports/WhatsAppMessenger.js";
import { connectionSecretContext, type WhatsAppConnection } from "../../domains/connections/domain/WhatsAppConnection.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { routeWhatsAppWebhooks } from "../../apps/api/routes/routeWhatsAppWebhooks.js";
import type { ConnectionsServices } from "../../apps/api/composition/composeConnectionsServices.js";
import type { MessagingServices } from "../../apps/api/composition/composeMessagingServices.js";
import type { OutboundMessage } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// El canal de WhatsApp con uazapi: leer sus avisos de mensajes (y descartar lo
// que no es de un cliente), enviar cada tipo de respuesta, respetar pausas,
// no detenerse por un fallo y verificar que el aviso viene de esa conexión.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const TOKEN = "token-de-la-instancia";

const uazapiMessage = (message: Record<string, unknown>, root: Record<string, unknown> = {}) => ({
  EventType: "messages",
  owner: "573013815302",
  token: TOKEN,
  BaseUrl: "https://free.uazapi.com",
  instanceName: `auream-${CONNECTION}`,
  message: {
    id: "573013815302:MSG1",
    messageid: "MSG1",
    chatid: "573001112233@s.whatsapp.net",
    sender: "573001112233@s.whatsapp.net",
    senderName: "Laura Gómez",
    fromMe: false,
    isGroup: false,
    messageType: "Conversation",
    text: "Hola, quiero info",
    messageTimestamp: 1794200000000,
    ...message
  },
  ...root
});

describe("parseUazapiMessage", () => {
  it("lee el mensaje documentado por uazapi", () => {
    const parsed = parseUazapiMessage(uazapiMessage({}));
    expect(parsed.ok && parsed.event).toMatchObject({
      instanceName: `auream-${CONNECTION}`,
      token: TOKEN,
      needsMediaDownload: false,
      message: { providerMessageId: "MSG1", phone: "573001112233", senderName: "Laura Gómez", kind: "text", text: "Hola, quiero info", replyId: null, fromAd: false }
    });
  });

  it("descarta lo que no es de un cliente: propio, enviado por la API, grupos, estados", () => {
    for (const message of [{ fromMe: true }, { wasSentByApi: true }, { isGroup: true }, { chatid: "123-456@g.us" }, { chatid: "status@broadcast" }]) {
      expect(parseUazapiMessage(uazapiMessage(message)).ok).toBe(false);
    }
    expect(parseUazapiMessage({ EventType: "connection" }).ok).toBe(false);
  });

  it("botón o lista elegida: id y título; imagen sin enlace: hay que descargarla", () => {
    const button = parseUazapiMessage(uazapiMessage({ messageType: "ButtonsResponseMessage", text: "Planes", buttonOrListid: "opt-1" }));
    expect(button.ok && button.event.message).toMatchObject({ kind: "button_reply", replyId: "opt-1", text: "Planes" });
    const image = parseUazapiMessage(uazapiMessage({ messageType: "ImageMessage", text: "mi pago" }));
    expect(image.ok && image.event).toMatchObject({ needsMediaDownload: true, message: { kind: "image", text: "mi pago", media: null } });
  });

  it("toma el teléfono real aunque el chat use un id «@lid»", () => {
    const parsed = parseUazapiMessage(uazapiMessage({ chatid: "1234567890@lid", sender: "1234567890@lid", sender_pn: "573001112233@s.whatsapp.net" }));
    expect(parsed.ok && parsed.event.message.phone).toBe("573001112233");
  });
});

describe("UazapiMessenger", () => {
  function server() {
    const calls: Array<{ path: string; body: Record<string, unknown>; token: string }> = [];
    const fetchImpl: FetchLike = vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ path: new URL(input).pathname, body: JSON.parse(String(init?.body ?? "{}")), token: (init?.headers as Record<string, string>)["token"]! });
      return new Response(JSON.stringify({ response: { status: "success" } }), { status: 200 });
    });
    return { calls, messenger: new UazapiMessenger(new UazapiClient({ baseUrl: "https://x.uazapi.com", adminToken: "a" }, fetchImpl)) };
  }
  const session = { ref: "r", secret: TOKEN };
  const base = { channel: "whatsapp", conversationKey: "c" };

  it("texto, archivo, botones, lista y reacción van a su llamada de uazapi", async () => {
    const api = server();
    const messages: OutboundMessage[] = [
      { ...base, content: "Hola" },
      { ...base, kind: "media", content: "Catálogo", media: { type: "file", url: "https://blob/x.pdf", fileName: "precios.pdf" } },
      { ...base, content: "1. A\n2. B", interactive: { type: "buttons", body: "¿Qué quieres?", options: [{ id: "a", title: "Planes" }, { id: "b", title: "Asesor" }] } },
      { ...base, content: "…", interactive: { type: "list", body: "Elige", buttonLabel: "Ver", options: [{ id: "x", title: "Tenis", description: "Talla 40" }] } },
      { ...base, kind: "reaction", content: "👍", replyToMessageId: "MSG1" }
    ];
    for (const message of messages) await api.messenger.send(session, "573001112233", message);
    expect(api.calls.map((c) => [c.path, c.body])).toEqual([
      ["/send/text", { number: "573001112233", text: "Hola" }],
      ["/send/media", { number: "573001112233", type: "document", file: "https://blob/x.pdf", text: "Catálogo", docName: "precios.pdf" }],
      ["/send/menu", { number: "573001112233", type: "button", text: "¿Qué quieres?", choices: ["Planes|a", "Asesor|b"] }],
      ["/send/menu", { number: "573001112233", type: "list", text: "Elige", choices: ["Tenis|x|Talla 40"], listButton: "Ver" }],
      ["/message/react", { id: "MSG1", text: "👍" }]
    ]);
    expect(api.calls.every((c) => c.token === TOKEN)).toBe(true);
  });
});

describe("ConnectionChannelServices", () => {
  async function setup(messenger: WhatsAppMessenger) {
    const repository = new InMemoryConnectionRepository();
    const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
    const at = new Date().toISOString();
    const connection: WhatsAppConnection = {
      id: CONNECTION, tenantId: T, name: "Ventas", method: "qr", status: "connected", phoneNumber: "573013815302", profileName: null,
      providerRef: "inst", providerSecret: cipher.encrypt(TOKEN, connectionSecretContext(T, CONNECTION)), lastConnectedAt: at, createdAt: at, updatedAt: at
    };
    await repository.save(connection);
    const sleep = vi.fn(async () => undefined);
    return { sleep, channel: new ConnectionChannelServices(repository, { for: () => messenger }, cipher, sleep) };
  }
  const base = { channel: "whatsapp", conversationKey: "c" };

  it("autentica el aviso solo con el token de esa conexión", async () => {
    const { channel } = await setup({ send: vi.fn(), inboundMedia: vi.fn() });
    expect((await channel.authenticate(CONNECTION, TOKEN))?.id).toBe(CONNECTION);
    expect(await channel.authenticate(CONNECTION, "otro")).toBeNull();
    expect(await channel.authenticate("33333333-3333-4333-8333-333333333333", TOKEN)).toBeNull();
  });

  it("envía en orden, espera las pausas (acorta las largas) y un fallo no detiene el resto", async () => {
    const send = vi.fn(async (_s: unknown, _p: string, message: OutboundMessage) => {
      if (message.content === "falla") throw new MessengerError("uazapi: respondió 500.");
    });
    const { channel, sleep } = await setup({ send, inboundMedia: vi.fn() });
    const report = await channel.deliver(T, CONNECTION, "573001112233", [
      { ...base, content: "uno" },
      { ...base, kind: "pause", content: "", delayMs: 3000 },
      { ...base, content: "falla" },
      { ...base, kind: "pause", content: "", delayMs: 60_000 },
      { ...base, content: "dos" }
    ]);
    expect(send.mock.calls.map((c) => (c[2] as OutboundMessage).content)).toEqual(["uno", "falla", "dos"]);
    expect(sleep.mock.calls).toEqual([[3000], [MAX_INLINE_PAUSE_MS]]);
    expect(report.sent).toBe(2);
    expect(report.failures).toHaveLength(2);
  });
});

describe("routeWhatsAppWebhooks · mensajes", () => {
  const req = (body: unknown) => Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: "POST", url: "/webhooks/uazapi", headers: {} }) as unknown as IncomingMessage;
  const recorder = () => {
    const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
    return response;
  };

  it("responde enseguida y procesa después, con la conexión verificada, el archivo descargado y la foto del contacto al día", async () => {
    const tasks: Array<() => Promise<unknown>> = [];
    const execute = vi.fn(async () => ({ outcome: "flow_started" }));
    const refreshIfStale = vi.fn(async (_t: string, _p: string, fetch: () => Promise<string | null>) => (await fetch(), true));
    const profilePicture = vi.fn(async () => "https://pps.whatsapp.net/v/cliente.jpg");
    const connection = { id: CONNECTION, tenantId: T };
    const connections = {
      providerEvents: { execute: vi.fn() },
      webhooks: { ensureCurrent: vi.fn(async () => undefined) },
      channel: { authenticate: vi.fn(async (_id: string, token: string) => (token === TOKEN ? connection : null)), inboundMedia: vi.fn(async () => ({ url: "https://cdn/x.jpg", mimeType: "image/jpeg" })), profilePicture }
    } as unknown as ConnectionsServices;
    const response = recorder();
    await routeWhatsAppWebhooks(req(uazapiMessage({ messageType: "ImageMessage", text: "" })), response as never, new URL("http://x/webhooks/uazapi"), connections, { inbound: { execute }, avatars: { refreshIfStale } } as unknown as MessagingServices, { run: (task) => tasks.push(task) });

    expect(response.statusCode).toBe(200);
    expect(execute).not.toHaveBeenCalled();
    await tasks[0]!();
    expect(execute).toHaveBeenCalledWith(T, expect.objectContaining({ connectionId: CONNECTION, kind: "image", media: { url: "https://cdn/x.jpg", mimeType: "image/jpeg" } }));
    expect(refreshIfStale).toHaveBeenCalledWith(T, expect.stringMatching(/^\d+$/), expect.any(Function));
    expect(profilePicture).toHaveBeenCalledWith(connection, refreshIfStale.mock.calls[0]![1]);
  });

  it("un aviso con otro token no procesa nada", async () => {
    const tasks: Array<() => Promise<unknown>> = [];
    const execute = vi.fn();
    const connections = { channel: { authenticate: vi.fn(async () => null) } } as unknown as ConnectionsServices;
    await routeWhatsAppWebhooks(req(uazapiMessage({}, { token: "falso" })), recorder() as never, new URL("http://x/webhooks/uazapi"), connections, { inbound: { execute } } as unknown as MessagingServices, { run: (task) => tasks.push(task) });
    await tasks[0]!();
    expect(execute).not.toHaveBeenCalled();
  });
});
