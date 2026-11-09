import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { MessageItem } from "../../contracts/MessageConfig.js";
import type { OutboundMessage } from "../../contracts/RuntimeContracts.js";
import { presenceBefore } from "../../flow-engine/nodes/message/MessageNodeHandler.js";
import { ConnectionChannelServices } from "../../domains/connections/application/ConnectionChannelServices.js";
import type { WhatsAppMessenger } from "../../domains/connections/application/ports/WhatsAppMessenger.js";
import { connectionSecretContext, type WhatsAppConnection } from "../../domains/connections/domain/WhatsAppConnection.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { UazapiClient, type FetchLike } from "../../infrastructure/whatsapp/uazapi/UazapiClient.js";
import { UazapiMessenger } from "../../infrastructure/whatsapp/uazapi/UazapiMessenger.js";

// ---------------------------------------------------------------------------
// «Escribiendo…» y «grabando audio…» como en Leona: en cada pausa de un
// Mensaje el cliente ve lo que se prepara, mientras dura la pausa y sin
// alargarla; cada mensaje que sale trae su id de WhatsApp (para los chulos) y
// se informa apenas sale (la bandeja en vivo).
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const TOKEN = "token-de-la-instancia";
const PHONE = "573001112233";
const base = { channel: "whatsapp", conversationKey: "c" };

describe("qué ve el cliente en cada pausa", () => {
  it("«grabando audio…» antes de un audio, «escribiendo…» antes de lo demás, nada al final", () => {
    const items: MessageItem[] = [
      { id: "p0", kind: "interval", amount: 6, unit: "seconds" },
      { id: "t", kind: "text", text: "Hola" },
      { id: "p1", kind: "interval", amount: 3, unit: "seconds" },
      { id: "p2", kind: "interval", amount: 2, unit: "seconds" },
      { id: "a", kind: "audio", url: "https://blob/nota.ogg", caption: "", sendOnce: false },
      { id: "p3", kind: "interval", amount: 4, unit: "seconds" },
      { id: "i", kind: "image", url: "https://blob/foto.jpg", caption: "", sendOnce: false },
      { id: "p4", kind: "interval", amount: 1, unit: "seconds" }
    ];
    const atPauses = items.flatMap((item, index) => (item.kind === "interval" ? [presenceBefore(items, index)] : []));
    // Dos pausas seguidas antes del audio: las dos muestran «grabando audio…».
    expect(atPauses).toEqual(["composing", "recording", "recording", "composing", undefined]);
  });
});

describe("la entrega con presencia", () => {
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

  it("muestra la presencia durante cada pausa, informa cada mensaje con su id al salir y no muestra esperas de más de 5 min", async () => {
    const presence = vi.fn(async () => undefined);
    const send = vi.fn(async (_s: unknown, _p: string, message: OutboundMessage) => ({ providerMessageId: `WA-${message.content}` }));
    const { channel, sleep } = await setup({ send, presence, inboundMedia: vi.fn() });
    const informed: string[] = [];
    const report = await channel.deliver(T, CONNECTION, PHONE, [
      { ...base, kind: "pause", content: "", delayMs: 6_000, presence: "composing" },
      { ...base, content: "Hola" },
      { ...base, kind: "pause", content: "", delayMs: 4_000, presence: "recording" },
      { ...base, kind: "media", content: "nota", media: { type: "audio", url: "https://blob/nota.ogg" } },
      { ...base, kind: "pause", content: "", delayMs: 2_000 },
      // Pausa que retoma la cola de tareas: solo se avisa, no se espera.
      { ...base, kind: "presence", content: "", delayMs: 180_000, presence: "composing" },
      { ...base, kind: "presence", content: "", delayMs: 30 * 60_000, presence: "composing" }
    ], async (result) => {
      // En vivo: cuando se informa un mensaje, el siguiente aún no salió.
      informed.push(`${result.message.content}:${result.providerMessageId}:${send.mock.calls.length}`);
    });

    expect(presence.mock.calls.map((call) => [call[1], call[2], call[3]])).toEqual([[PHONE, "composing", 6_000], [PHONE, "recording", 4_000], [PHONE, "composing", 180_000]]);
    expect(sleep.mock.calls).toEqual([[6_000], [4_000], [2_000]]);
    expect(informed).toEqual(["Hola:WA-Hola:1", "nota:WA-nota:2"]);
    expect(report).toMatchObject({ sent: 2, failures: [] });
    expect(report.results.map((result) => result.providerMessageId)).toEqual(["WA-Hola", "WA-nota"]);
  });

  it("si la presencia falla, el mensaje igual sale", async () => {
    const send = vi.fn(async () => ({ providerMessageId: "WA-1" }));
    const presence = vi.fn(async () => {
      throw new Error("uazapi caído");
    });
    const { channel } = await setup({ send, presence, inboundMedia: vi.fn() });
    const report = await channel.deliver(T, CONNECTION, PHONE, [{ ...base, kind: "pause", content: "", delayMs: 3_000, presence: "composing" }, { ...base, content: "Hola" }]);
    expect(report).toMatchObject({ sent: 1, failures: [] });
  });
});

describe("uazapi: id del mensaje y presencia", () => {
  it("el envío devuelve el `messageid` de WhatsApp; la presencia va a /message/presence con su duración (máx. 5 min)", async () => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    const fetchImpl: FetchLike = vi.fn(async (input: string, init?: RequestInit) => {
      const path = new URL(input).pathname;
      calls.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
      const body = path === "/send/text" ? { id: "573013815302:3EB0ABC", messageid: "3EB0ABC", status: "Pending" } : { response: "Presence set" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const messenger = new UazapiMessenger(new UazapiClient({ baseUrl: "https://x.uazapi.com", adminToken: "a" }, fetchImpl));
    const session = { ref: "r", secret: TOKEN };

    expect(await messenger.send(session, PHONE, { ...base, content: "Hola" })).toEqual({ providerMessageId: "3EB0ABC" });
    await messenger.presence(session, PHONE, "recording", 4_000);
    await messenger.presence(session, PHONE, "composing", 600_000);
    expect(calls.slice(1)).toEqual([
      { path: "/message/presence", body: { number: PHONE, presence: "recording", delay: 4_000 } },
      { path: "/message/presence", body: { number: PHONE, presence: "composing", delay: 300_000 } }
    ]);
  });
});
