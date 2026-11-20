import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NotificationSettingsResponse } from "@contracts/NotificationSettingsContracts";
import { NotificationSettings } from "../../src/features/notification-settings/NotificationSettings";

// ---------------------------------------------------------------------------
// Configuración › Notificaciones: activar en este dispositivo (permiso del
// navegador + suscripción + guardarlo), probar, desactivar, quitar otros
// dispositivos; iPhone sin instalar y avisos bloqueados explicados; y qué te
// avisamos, guardado al tocar cada interruptor.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const PUB = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const base = (over: Partial<NotificationSettingsResponse> = {}): NotificationSettingsResponse => ({
  push: { available: true, publicKey: PUB },
  devices: [],
  topics: [{ topic: "chat_message", enabled: true }, { topic: "follow_up_due", enabled: true }],
  ...over
});

let state: NotificationSettingsResponse;
let calls: Array<{ method: string; path: string; body: unknown }>;
let subscription: { toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null;
let permission: NotificationPermission;

function stubServer() {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });
    if (url.pathname === "/notifications/settings") return reply(200, state);
    if (url.pathname === "/notifications/push/devices" && method === "POST") {
      state = { ...state, devices: [{ id: "dev-here", label: body.label, createdAt: new Date().toISOString(), lastUsedAt: null }, ...state.devices] };
      return reply(201, { deviceId: "dev-here" });
    }
    const topic = /^\/notifications\/settings\/topics\/(\w+)$/.exec(url.pathname);
    if (topic) {
      state = { ...state, topics: state.topics.map((t) => (t.topic === topic[1] ? { ...t, enabled: body.enabled } : t)) };
      return reply(200, state);
    }
    const device = /^\/notifications\/push\/devices\/([\w-]+)(\/test)?$/.exec(url.pathname);
    if (device && method === "DELETE") {
      state = { ...state, devices: state.devices.filter((d) => d.id !== device[1]) };
      return reply(200, state);
    }
    if (device && device[2]) return reply(200, { sent: true });
    return reply(404, {});
  }));
}

function stubBrowser(options: { supported?: boolean; ua?: string } = {}) {
  const pushManager = {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async () => {
      subscription = { toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) } }), unsubscribe: vi.fn(async () => true) };
      return subscription;
    })
  };
  const registration = { pushManager };
  if (options.supported === false) {
    delete (navigator as unknown as Record<string, unknown>)["serviceWorker"];
    delete (window as unknown as Record<string, unknown>)["PushManager"];
  } else {
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn(async () => registration), ready: Promise.resolve(registration), getRegistration: vi.fn(async () => registration) } });
    Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
  }
  const notification = Object.assign(function Notification() {}, { requestPermission: vi.fn(async () => permission) });
  Object.defineProperty(notification, "permission", { get: () => (permission === "granted" && !subscription ? "default" : permission) });
  vi.stubGlobal("Notification", notification);
  if (options.ua) Object.defineProperty(navigator, "userAgent", { configurable: true, value: options.ua });
  return pushManager;
}

beforeEach(() => {
  state = base();
  subscription = null;
  permission = "granted";
  window.localStorage.clear();
  stubServer();
});

describe("Configuración › Notificaciones", () => {
  it("activar en este dispositivo: pide el permiso, se suscribe con la clave de Auream y queda «Activadas»", async () => {
    const pushManager = stubBrowser();
    render(<NotificationSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "Activar en este dispositivo" }));
    expect(await screen.findByText("● Activadas en este dispositivo")).toBeInTheDocument();
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(calls.find((c) => c.method === "POST" && c.path === "/notifications/push/devices")?.body).toMatchObject({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { auth: "a".repeat(22) } });
    expect(window.localStorage.getItem("auream-push-device")).toBe("dev-here");
    const list = screen.getByRole("list", { name: "Tus dispositivos" });
    expect(within(list).getByText(/Este dispositivo/)).toBeInTheDocument();
  });

  it("probar y desactivar aquí: la prueba va a este dispositivo; desactivar lo quita de Auream y del navegador", async () => {
    stubBrowser();
    subscription = { toJSON: () => ({}), unsubscribe: vi.fn(async () => true) };
    const current = subscription;
    window.localStorage.setItem("auream-push-device", "dev-here");
    state = base({ devices: [{ id: "dev-here", label: "Chrome en Mac", createdAt: "2026-11-18T00:00:00.000Z", lastUsedAt: null }] });
    render(<NotificationSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "Enviar una prueba" }));
    expect(await screen.findByText(/Enviamos un aviso de prueba/)).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ method: "POST", path: "/notifications/push/devices/dev-here/test" });
    await userEvent.click(screen.getByRole("button", { name: "Desactivar aquí" }));
    expect(await screen.findByRole("button", { name: "Activar en este dispositivo" })).toBeInTheDocument();
    expect(current.unsubscribe).toHaveBeenCalled();
    expect(window.localStorage.getItem("auream-push-device")).toBeNull();
  });

  it("los demás dispositivos se pueden quitar desde aquí", async () => {
    stubBrowser();
    state = base({ devices: [{ id: "dev-phone", label: "Safari en iPhone", createdAt: "2026-11-10T00:00:00.000Z", lastUsedAt: "2026-11-20T09:00:00.000Z" }] });
    render(<NotificationSettings />);
    const list = await screen.findByRole("list", { name: "Tus dispositivos" });
    expect(within(list).getByText("Safari en iPhone")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Tus dispositivos" })).not.toBeInTheDocument());
  });

  it("si la persona bloqueó los avisos, explica cómo permitirlos", async () => {
    permission = "denied";
    stubBrowser();
    render(<NotificationSettings />);
    expect(await screen.findByText(/Bloqueaste los avisos para Auream/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar en este dispositivo" })).not.toBeInTheDocument();
  });

  it("en iPhone sin instalar, explica cómo instalar Auream primero; sin claves en el servidor, que aún no están activos", async () => {
    stubBrowser({ supported: false, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari" });
    const { unmount } = render(<NotificationSettings />);
    expect(await screen.findByText(/En iPhone, primero instala Auream/)).toBeInTheDocument();
    unmount();
    state = base({ push: { available: false, publicKey: null } });
    stubBrowser();
    render(<NotificationSettings />);
    expect(await screen.findByText(/todavía no están activos en Auream/)).toBeInTheDocument();
  });

  it("qué te avisamos: un interruptor por aviso, se guarda al tocarlo", async () => {
    stubBrowser();
    render(<NotificationSettings />);
    const chat = await screen.findByRole("switch", { name: /Un cliente te escribió/ });
    expect(chat).toBeChecked();
    expect(screen.queryByRole("switch", { name: /Número desconectado/ })).not.toBeInTheDocument();
    await userEvent.click(chat);
    await waitFor(() => expect(screen.getByRole("switch", { name: /Un cliente te escribió/ })).not.toBeChecked());
    expect(calls.at(-1)).toMatchObject({ method: "PUT", path: "/notifications/settings/topics/chat_message", body: { enabled: false } });
  });
});
