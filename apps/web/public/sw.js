/*
 * El service worker de Auream: recibe los avisos al celular o al computador
 * (Web Push) aunque Auream esté cerrado, y al tocarlos abre la pantalla donde
 * se resuelven. No guarda nada en caché: Auream siempre carga lo último.
 *
 * El aviso llega cifrado desde el servidor (domains/notifications): { title,
 * body, url, tag }. Mismo `tag` = reemplaza el aviso anterior (cinco mensajes
 * seguidos de un cliente = un solo aviso que se actualiza).
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Auream";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: typeof data.url === "string" ? data.url : "/" }
  };
  if (typeof data.tag === "string" && data.tag) {
    options.tag = data.tag;
    // Si reemplaza a uno anterior, igual suena (es un mensaje nuevo).
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

/** Solo pantallas de Auream: una dirección de afuera nunca se abre desde un aviso. */
function appUrl(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? new URL(path, self.location.origin).href : new URL("/", self.location.origin).href;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = appUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
