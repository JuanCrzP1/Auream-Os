import { describe, expect, it } from "vitest";
import { NotificationSettingsServices, type NotificationActor } from "../../domains/notifications/application/NotificationSettingsServices.js";
import type { PushDeviceStore, PushPreferenceStore, PushResult, PushSender, StoredPushDevice } from "../../domains/notifications/application/PushPorts.js";
import type { PushTopic } from "../../contracts/NotificationSettingsContracts.js";
import { loadPushConfig } from "../../apps/api/config/loadPushConfig.js";

// ---------------------------------------------------------------------------
// Configuración › Notificaciones: cada persona ve y cambia solo lo suyo; se le
// ofrecen los avisos que puede resolver; activar exige una dirección de un
// servicio de avisos real; la prueba olvida el dispositivo que ya no existe.
// Y las claves del servidor: juntas, con su formato, o ninguna.
// ---------------------------------------------------------------------------

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const AGENT: NotificationActor = { tenantId: "t1", userId: ME, scopes: ["conversations.write", "crm.write", "sales.read", "team.read"] };
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const KEYS = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

function setup(result: PushResult = "sent", withSender = true) {
  const store: StoredPushDevice[] = [];
  const prefs = new Map<string, boolean>();
  const devices: PushDeviceStore = {
    save: async (d) => {
      const existing = store.findIndex((s) => s.endpoint === d.endpoint);
      const row = { id: existing >= 0 ? store[existing]!.id : `dev-${store.length + 1}`, createdAt: "2026-11-20T00:00:00.000Z", lastUsedAt: null, ...d };
      if (existing >= 0) store[existing] = row;
      else store.push(row);
      return row.id;
    },
    listForUser: async (userId) => store.filter((s) => s.userId === userId),
    listForUsers: async () => [],
    remove: async (userId, id) => {
      const i = store.findIndex((s) => s.id === id && s.userId === userId);
      if (i < 0) return false;
      store.splice(i, 1);
      return true;
    },
    forget: async (id) => void store.splice(store.findIndex((s) => s.id === id), 1),
    touch: async () => undefined
  };
  const preferences: PushPreferenceStore = {
    get: async (tenantId, userId) => new Map([...prefs].filter(([k]) => k.startsWith(`${tenantId}:${userId}:`)).map(([k, v]) => [k.split(":")[2] as PushTopic, v])),
    set: async (tenantId, userId, topic, enabled) => void prefs.set(`${tenantId}:${userId}:${topic}`, enabled),
    mutedAmong: async () => new Set()
  };
  const sender: PushSender = { publicKey: "PUB", send: async () => result };
  return { services: new NotificationSettingsServices(devices, preferences, withSender ? sender : null), store };
}

describe("Configuración › Notificaciones", () => {
  it("ofrece los avisos que la persona puede resolver, prendidos hasta que los apague", async () => {
    const { services } = setup();
    const view = await services.view(AGENT);
    expect(view).toEqual({ push: { available: true, publicKey: "PUB" }, devices: [], topics: [{ topic: "chat_message", enabled: true }, { topic: "follow_up_due", enabled: true }] });
    expect((await services.setTopic(AGENT, "follow_up_due", false)).topics).toEqual([{ topic: "chat_message", enabled: true }, { topic: "follow_up_due", enabled: false }]);
    await expect(services.setTopic(AGENT, "number_disconnected", false)).rejects.toThrow("Ese aviso no existe.");
    await expect(services.setTopic(AGENT, "chat_message", "no")).rejects.toThrow("prendido o apagado");
  });

  it("activar guarda el dispositivo una sola vez (el mismo navegador se actualiza) con su nombre limpio", async () => {
    const { services, store } = setup();
    const first = await services.subscribe(AGENT, { endpoint: ENDPOINT, keys: KEYS, label: "Chrome  en Mac" });
    const again = await services.subscribe(AGENT, { endpoint: ENDPOINT, keys: KEYS, label: "Chrome en Mac" });
    expect(again.deviceId).toBe(first.deviceId);
    expect(store).toHaveLength(1);
    expect((await services.view(AGENT)).devices).toEqual([{ id: first.deviceId, label: "Chrome en Mac", createdAt: expect.any(String), lastUsedAt: null }]);
  });

  it("solo direcciones de servicios de avisos reales y claves bien formadas", async () => {
    const { services } = setup();
    await expect(services.subscribe(AGENT, { endpoint: "https://10.0.0.1/hook", keys: KEYS })).rejects.toThrow("dirección de avisos válida");
    await expect(services.subscribe(AGENT, { endpoint: ENDPOINT, keys: { p256dh: "corta", auth: KEYS.auth } })).rejects.toThrow("claves de avisos");
    await expect(services.subscribe(AGENT, { endpoint: ENDPOINT })).rejects.toThrow("claves de avisos");
    await expect(setup("sent", false).services.subscribe(AGENT, { endpoint: ENDPOINT, keys: KEYS })).rejects.toThrow("todavía no están activos");
  });

  it("cada uno quita y prueba solo sus dispositivos; la prueba olvida el que ya no existe", async () => {
    const { services, store } = setup("gone");
    const { deviceId } = await services.subscribe(AGENT, { endpoint: ENDPOINT, keys: KEYS });
    const someoneElse: NotificationActor = { ...AGENT, userId: OTHER };
    await expect(services.removeDevice(someoneElse, deviceId)).rejects.toThrow("Ese dispositivo no existe.");
    await expect(services.test(someoneElse, deviceId)).rejects.toThrow("Ese dispositivo no existe.");
    await expect(services.test(AGENT, deviceId)).rejects.toThrow("ya no recibe avisos");
    expect(store).toHaveLength(0);

    const ok = setup("sent");
    const added = await ok.services.subscribe(AGENT, { endpoint: ENDPOINT, keys: KEYS });
    expect(await ok.services.test(AGENT, added.deviceId)).toEqual({ sent: true });
    expect((await ok.services.removeDevice(AGENT, added.deviceId)).devices).toEqual([]);
  });
});

describe("las claves del servidor (VAPID)", () => {
  const pub = "B".repeat(87);
  const priv = "c".repeat(43);
  it("sin ninguna no hay avisos; juntas y con su formato; el contacto por defecto es la app", () => {
    expect(loadPushConfig({}, "https://auream.app")).toBeNull();
    expect(loadPushConfig({ VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv }, "https://auream.app")).toEqual({ publicKey: pub, privateKey: priv, subject: "https://auream.app" });
    expect(() => loadPushConfig({ VAPID_PUBLIC_KEY: pub }, "https://auream.app")).toThrow("van juntas");
    expect(() => loadPushConfig({ VAPID_PUBLIC_KEY: "corta", VAPID_PRIVATE_KEY: priv }, "https://auream.app")).toThrow("formato esperado");
    expect(() => loadPushConfig({ VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv }, "http://localhost:5173")).toThrow("VAPID_SUBJECT");
    expect(loadPushConfig({ VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: "mailto:soporte@ejemplo.com" }, "http://localhost:5173")?.subject).toBe("mailto:soporte@ejemplo.com");
  });
});
