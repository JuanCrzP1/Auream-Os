# Notificaciones

Dos piezas, un mismo módulo (`domains/notifications`):

- **La campana** (dentro de Auream): lo que pide atención, leído del estado de cada módulo. Ver [`domains/notifications/README.md`](../../domains/notifications/README.md).
- **Los avisos al celular o al computador** (Web Push): suenan aunque Auream esté cerrado. Este documento.

## Qué avisa y a quién

| Aviso (`PushTopic`) | Cuándo | A quién | Lleva a |
|---|---|---|---|
| `chat_message` | Un cliente escribe en un chat **en atención** (`status = 'attending'`) | Quien atiende ese chat (`assignee_id`) | `/conversations?search=` |
| `number_disconnected` | Un número **conectado** se cae solo: aviso del proveedor o la revisión al abrir Conexiones. No cuando una persona lo desconecta | `connections.write` (dueños y administradores) | `/connections` |
| `sale_review` | Una venta **nueva** queda «Por revisar» (flujo o anotada a mano) | `sales.manage`, menos quien la anotó | `/sales?tab=review` |
| `follow_up_due` | A la hora de un seguimiento (tarea `notifications.follow_up_due` en la cola) | Su responsable | `/crm?tab=follow-ups` |

El permiso es el mismo que hace falta para resolverlo (`pushTopicRules.ts`). Cada persona apaga lo que no quiere, por empresa (`notification_preferences`; sin fila, prendido). Solo personas activas de la empresa (`memberships.status = 'active'`).

## Cómo sale un aviso

1. **El evento.** Cada módulo avisa «pasó esto» con un gancho y no conoce a Notificaciones: `HandleProviderEventService`/`VerifyConnectionsService` (`onDropped`), `SaleEvents.saleNeedsReview`, `FollowUpServices` (`onScheduled`) y un `InboundListener` de Mensajería. La composición los une en `apps/api/composition/composeNotificationPush.ts`.
2. **En segundo plano** (`BackgroundTasks`): un aviso nunca demora un chat, un flujo ni una pantalla. El de un seguimiento espera su hora en la cola (uno por seguimiento: moverlo reemplaza el anterior; si ya se hizo o cambió de hora, no suena).
3. **`PushNotifier`**: a quién le toca → quién no lo apagó → sus dispositivos → `WebPushSender` (web-push 3.6.7, VAPID, TTL 1 h, urgencia alta). Si el servicio dice 404/410, el dispositivo se olvida. Nunca lanza.
4. **En el navegador**, `apps/web/public/sw.js` lo muestra; el mismo `tag` reemplaza al anterior (cinco mensajes = un aviso). Al tocarlo abre la pantalla (solo direcciones de Auream).

## Dispositivos

- `push_subscriptions` (`057_push_notifications.sql`): de la **persona**, no de la empresa. El `endpoint` es único: el mismo navegador nunca se duplica y, si cambia de persona, pasa a la nueva.
- **Solo servicios de avisos reales** (`pushEndpoint.ts`: Google, Mozilla, Apple, Microsoft). El servidor le hace una petición a esa dirección: aceptar cualquiera abriría la puerta a llamar direcciones internas (SSRF).
- **Cerrar sesión** quita el dispositivo (Auream y navegador) antes de salir.
- **iPhone**: Apple exige instalar Auream en la pantalla de inicio (`manifest.webmanifest`, íconos en `public/icons`, hechos del isotipo oficial).

## Configuración

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (opcional; por defecto la dirección https de la app). Se generan una vez con `npx web-push generate-vapid-keys` y van en Vercel. Sin las dos claves no hay avisos al celular: la página lo dice y nada falla. Si se cambian, cada persona vuelve a activarlos.

## API

| Ruta | Permiso |
|---|---|
| `GET /notifications/settings` · `PUT /notifications/settings/topics/:topic` | `team.read` (cada persona, lo suyo) |
| `POST /notifications/push/devices` · `DELETE /notifications/push/devices/:id` · `POST /notifications/push/devices/:id/test` | `team.read` (cada persona, lo suyo) |

Una credencial o la clave de desarrollo no tienen dispositivos (403).

## Pruebas

- `tests/unit/pushNotifications.test.ts`, `notificationSettings.test.ts`, `composeNotificationPush.test.ts`
- Los ganchos: `connections.test.ts`, `connectionSession.test.ts`, `crmFollowUps.test.ts`, `recordSaleBlock.test.ts`
- `tests/security/routeNotificationSettings.test.ts`
- `tests/integration/pushNotificationsPersistence.test.ts` (PostgreSQL real)
- Web: `apps/web/tests/components/NotificationSettings.test.tsx`, `SidebarActions.test.tsx`, `apps/web/tests/unit/useSignOut.test.tsx`

## Más adelante

- Avisos por **correo** (falta un servicio de envío de correos).
- Más avisos (difusión pausada, flujo con fallas) si hace falta.
