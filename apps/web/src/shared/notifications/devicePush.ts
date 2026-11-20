import type { NotificationSettingsResponse, PushTopic, SubscribePushResponse } from "@contracts/NotificationSettingsContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// ---------------------------------------------------------------------------
// Los avisos en ESTE dispositivo, con las API del navegador (Service Worker,
// Push y Notification) y la de Auream. El id del dispositivo se recuerda en
// este navegador para saber cuál de la lista es «este».
// ---------------------------------------------------------------------------

export const SERVICE_WORKER_PATH = "/sw.js";
const DEVICE_KEY = "auream-push-device";

/** Puede recibir avisos; en iPhone primero hay que instalar Auream; o no puede. */
export type PushSupport = "supported" | "install" | "unsupported";

export const notificationSettingsApi = {
  get: () => builderApiClient.get<NotificationSettingsResponse>("/notifications/settings"),
  setTopic: (topic: PushTopic, enabled: boolean) => builderApiClient.put<NotificationSettingsResponse>(`/notifications/settings/topics/${topic}`, { enabled }),
  removeDevice: (deviceId: string) => builderApiClient.delete<NotificationSettingsResponse>(`/notifications/push/devices/${encodeURIComponent(deviceId)}`),
  test: (deviceId: string) => builderApiClient.post<{ sent: boolean }>(`/notifications/push/devices/${encodeURIComponent(deviceId)}/test`)
};

function isAppleMobile(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
  return isAppleMobile() && !isInstalled() ? "install" : "unsupported";
}

/** «Chrome en Mac», «Safari en iPhone»: para reconocer el dispositivo en la lista. */
export function deviceLabel(userAgent: string = navigator.userAgent): string {
  const browser = /edg\//i.test(userAgent) ? "Edge" : /firefox|fxios/i.test(userAgent) ? "Firefox" : /chrome|crios/i.test(userAgent) ? "Chrome" : /safari/i.test(userAgent) ? "Safari" : "Navegador";
  const system = /iphone/i.test(userAgent) ? "iPhone" : /ipad/i.test(userAgent) ? "iPad" : /android/i.test(userAgent) ? "Android" : /mac os/i.test(userAgent) ? "Mac" : /windows/i.test(userAgent) ? "Windows" : "computador";
  return `${browser} en ${system}`;
}

/** La clave pública como la pide el navegador (base64url → bytes). */
export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function rememberedDevice(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function remember(deviceId: string | null): void {
  try {
    if (deviceId) window.localStorage.setItem(DEVICE_KEY, deviceId);
    else window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* Sin almacenamiento: la lista no sabrá cuál es «este», nada más. */
  }
}

/** La suscripción de este navegador, si ya existe. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Activar en este dispositivo: pide el permiso (el navegador pregunta), se
 * suscribe con la clave de Auream y lo guarda. `denied`: la persona lo
 * bloqueó; `dismissed`: cerró la pregunta sin elegir.
 */
export async function enableOnThisDevice(publicKey: string): Promise<"enabled" | "denied" | "dismissed"> {
  await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  const registration = await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "dismissed";
  const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) }));
  const json = subscription.toJSON();
  const saved = await builderApiClient.post<SubscribePushResponse>("/notifications/push/devices", { endpoint: json.endpoint, keys: json.keys, label: deviceLabel() });
  remember(saved.deviceId);
  return "enabled";
}

/** Desactivar aquí: lo quita de Auream y del navegador. También al cerrar sesión (que el siguiente no reciba lo tuyo). */
export async function disableOnThisDevice(): Promise<void> {
  const deviceId = rememberedDevice();
  remember(null);
  if (deviceId) await notificationSettingsApi.removeDevice(deviceId).catch(() => undefined);
  const subscription = await currentSubscription().catch(() => null);
  await subscription?.unsubscribe().catch(() => false);
}
