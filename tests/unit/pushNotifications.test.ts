import { describe, expect, it, vi } from "vitest";
import { PushNotifier, type PushEvent } from "../../domains/notifications/application/PushNotifier.js";
import type { PushAudience, PushDeviceStore, PushPreferenceStore, PushResult, PushSender, StoredPushDevice } from "../../domains/notifications/application/PushPorts.js";
import { chatMessage, clip, messagePreview, saleReview } from "../../domains/notifications/domain/PushMessages.js";
import { deviceLabel, isPushServiceEndpoint } from "../../domains/notifications/domain/pushEndpoint.js";
import { roleReceives, topicsFor } from "../../domains/notifications/application/pushTopicRules.js";

// ---------------------------------------------------------------------------
// Los avisos al celular: qué dice cada uno, a quién le llega (el que atiende
// el chat, a quien se le asignó el seguimiento o quien puede resolverlo), que
// respete lo que cada persona apagó, que olvide los dispositivos que ya no
// existen y que nunca frene nada si algo falla.
// ---------------------------------------------------------------------------

const T = "tenant-a";
const OWNER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const AGENT = "33333333-3333-4333-8333-333333333333";
const VIEWER = "44444444-4444-4444-8444-444444444444";
const device = (id: string, userId: string): StoredPushDevice => ({ id, userId, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "k".repeat(40), auth: "a".repeat(16), label: "Chrome en Mac", createdAt: "2026-11-01T00:00:00.000Z", lastUsedAt: null });

function setup(options: { muted?: string[]; results?: Record<string, PushResult>; sender?: boolean; followUp?: Awaited<ReturnType<PushAudience["followUp"]>>; failAudience?: boolean } = {}) {
  const sent: Array<{ device: string; title: string; tag: string; url: string }> = [];
  const forgotten: string[] = [];
  const touched: string[] = [];
  const all = [device("d-owner", OWNER), device("d-admin", ADMIN), device("d-agent", AGENT), device("d-agent-2", AGENT), device("d-viewer", VIEWER)];
  const devices: PushDeviceStore = {
    save: async () => "x", listForUser: async () => [], remove: async () => true,
    listForUsers: async (userIds) => all.filter((d) => userIds.includes(d.userId)),
    forget: async (id) => void forgotten.push(id),
    touch: async (id) => void touched.push(id)
  };
  const preferences: PushPreferenceStore = { get: async () => new Map(), set: async () => undefined, mutedAmong: async (_t, _topic, ids) => new Set(ids.filter((id) => options.muted?.includes(id))) };
  const audience: PushAudience = {
    members: async () => {
      if (options.failAudience) throw new Error("db down");
      return [{ userId: OWNER, role: "tenant_owner" }, { userId: ADMIN, role: "tenant_admin" }, { userId: AGENT, role: "operator" }, { userId: VIEWER, role: "viewer" }];
    },
    chatAttendant: async (_t, _c, phone) => (phone === "573001112233" ? { conversationId: "conv-1", assigneeId: AGENT, contactName: "Laura Méndez" } : null),
    connectionName: async () => "flujo 1",
    followUp: async () => options.followUp ?? null
  };
  const sender: PushSender = {
    publicKey: "pub",
    send: async (d, message) => {
      sent.push({ device: d.id, title: message.title, tag: message.tag, url: message.url });
      return options.results?.[d.id] ?? "sent";
    }
  };
  const onError = vi.fn();
  const notifier = new PushNotifier({ devices, preferences, audience, sender: options.sender === false ? null : sender, onError, now: () => new Date("2026-11-20T12:00:00.000Z") });
  return { notifier, sent, forgotten, touched, onError };
}

const chat: PushEvent = { topic: "chat_message", tenantId: T, connectionId: "c1", phone: "573001112233", kind: "text", text: "¿Cuánto cuesta la canción?" };

describe("qué dice cada aviso", () => {
  it("corta en una palabra y dice qué es un archivo sin texto", () => {
    expect(clip("uno dos tres cuatro", 12)).toBe("uno dos…");
    expect(messagePreview("audio", "")).toBe("🎤 Nota de voz");
    expect(messagePreview("image", "mi recibo")).toBe("📷 Foto: mi recibo");
    expect(messagePreview("text", "  ")).toBe("Te envió un mensaje");
  });

  it("un chat: quién escribió, qué dijo, lleva al chat y reemplaza el aviso anterior de ese chat", () => {
    expect(chatMessage({ contactName: null, phone: "573001112233", kind: "text", text: "Hola", conversationId: "conv-1" })).toEqual({ title: "+573001112233 te escribió", body: "Hola", url: "/conversations?search=573001112233", tag: "chat:conv-1" });
    expect(saleReview({ saleId: "s1", customerName: null, amount: null, reason: null }).body).toBe("Un cliente: revísala para que cuente en tus ventas.");
  });

  it("solo direcciones de servicios de avisos reales (nunca una interna); el nombre del dispositivo, limpio y corto", () => {
    expect(isPushServiceEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushServiceEndpoint("https://web.push.apple.com/QOk")).toBe(true);
    expect(isPushServiceEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    for (const bad of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x", "https://u:p@fcm.googleapis.com/x", "nada"]) {
      expect(isPushServiceEndpoint(bad)).toBe(false);
    }
    expect(deviceLabel(" Chrome\n en   Mac ")).toBe("Chrome en Mac");
    expect(deviceLabel("x".repeat(80))).toHaveLength(60);
  });

  it("cada aviso se ofrece a quien puede resolverlo", () => {
    expect(topicsFor(["conversations.write", "crm.write", "sales.read"])).toEqual(["chat_message", "follow_up_due"]);
    expect([roleReceives("tenant_admin", "number_disconnected"), roleReceives("operator", "number_disconnected"), roleReceives("viewer", "chat_message")]).toEqual([true, false, false]);
  });
});

describe("a quién le llega", () => {
  it("un cliente escribió: solo a quien atiende ese chat, en todos sus dispositivos", async () => {
    const { notifier, sent, touched } = setup();
    expect(await notifier.notify(chat)).toBe(2);
    expect(sent.map((s) => s.device)).toEqual(["d-agent", "d-agent-2"]);
    expect(sent[0]).toMatchObject({ title: "Laura Méndez te escribió", tag: "chat:conv-1" });
    expect(touched).toEqual(["d-agent", "d-agent-2"]);
  });

  it("un chat que atiende el bot o nadie no avisa", async () => {
    const { notifier, sent } = setup();
    expect(await notifier.notify({ ...chat, phone: "573009999999" })).toBe(0);
    expect(sent).toEqual([]);
  });

  it("número desconectado: dueños y administradores; venta por revisar: lo mismo, menos quien la anotó", async () => {
    const dropped = setup();
    await dropped.notifier.notify({ topic: "number_disconnected", tenantId: T, connectionId: "c1" });
    expect(dropped.sent.map((s) => s.device)).toEqual(["d-owner", "d-admin"]);
    expect(dropped.sent[0]?.title).toBe("Número desconectado");

    const review = setup();
    await review.notifier.notify({ topic: "sale_review", tenantId: T, saleId: "s1", customerName: "Ana", amount: "$ 49.900 COP", reason: "Falta el producto.", recordedBy: ADMIN });
    expect(review.sent.map((s) => s.device)).toEqual(["d-owner"]);
  });

  it("seguimiento: solo a quien se le asignó, y nunca si ya se hizo, se movió de hora o se borró", async () => {
    const due = { title: "Llamar", contactName: "Ana", assigneeId: AGENT, dueAt: "2026-11-20T15:00:00.000Z", doneAt: null };
    const event: PushEvent = { topic: "follow_up_due", tenantId: T, followUpId: "f1", dueAt: "2026-11-20T15:00:00.000Z" };
    const ok = setup({ followUp: due });
    expect(await ok.notifier.notify(event)).toBe(2);
    for (const stale of [{ ...due, doneAt: "2026-11-20T14:00:00.000Z" }, { ...due, dueAt: "2026-11-21T15:00:00.000Z" }, null]) {
      const run = setup({ followUp: stale });
      expect(await run.notifier.notify(event)).toBe(0);
    }
  });

  it("respeta a quien lo apagó; olvida el dispositivo que ya no existe; un fallo pasajero no lo borra", async () => {
    const run = setup({ muted: [OWNER], results: { "d-admin": "gone" } });
    expect(await run.notifier.notify({ topic: "number_disconnected", tenantId: T, connectionId: "c1" })).toBe(0);
    expect(run.sent.map((s) => s.device)).toEqual(["d-admin"]);
    expect(run.forgotten).toEqual(["d-admin"]);

    const flaky = setup({ results: { "d-agent": "failed" } });
    expect(await flaky.notifier.notify(chat)).toBe(1);
    expect(flaky.forgotten).toEqual([]);
  });

  it("sin claves no manda nada; si algo falla, lo avisa y nunca lanza", async () => {
    const off = setup({ sender: false });
    expect(await off.notifier.notify(chat)).toBe(0);
    const broken = setup({ failAudience: true });
    await expect(broken.notifier.notify(chat)).resolves.toBe(0);
    expect(broken.onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ step: "push.notify", topic: "chat_message" }));
  });
});
