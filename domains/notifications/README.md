# notifications — la campana del menú (bounded context)

La campana debajo de la tarjeta de la cuenta, abajo en la barra lateral (solo ícono, junto a la de soporte); su ventana se abre hacia arriba, del ancho del menú, como el menú del perfil. Web: `apps/web/src/shared/account/NotificationBell.tsx` y `apps/web/src/shared/notifications/`.

## Responsabilidad
Avisar lo que pide atención en la cuenta y llevar a la pantalla donde se resuelve.

## Los avisos
| Aviso | De dónde sale | Lleva a | Lo ve quien tenga |
|---|---|---|---|
| Un número se desconectó | `whatsapp_connections` | `/connections` | `connections.read` |
| Una difusión se pausó sola (con su motivo) | `broadcasts` | `/broadcasts?id=` | `broadcasts.read` |
| Ventas por revisar (un solo aviso con el total) | `sales` | `/sales?tab=review` | `sales.read` |
| MIS seguimientos de hoy o vencidos (día del negocio) | `crm_follow_ups` | `/crm?tab=follow-ups` | `crm.read` |
| Una campaña de grupos abrió un grupo nuevo (7 días) | `wa_groups` | `/groups?campaign=` | `groups.read` |

## Cómo funciona
- **Los avisos no se guardan.** Se leen del estado de cada módulo cuando la campana pregunta, y desaparecen solos cuando se resuelven (el número se reconecta, la venta se completa…).
- **«Nuevo»** es lo que pasó después de la última vez que la persona abrió la campana (`notification_reads.seen_at`, una fila por persona y cuenta, que nunca retrocede).
- La web pregunta al entrar, cada minuto con la pestaña visible y al volver a la pestaña. En Vercel Hobby no hay conexión abierta, así que no hay avisos al instante.
- Hasta 30 avisos, del más reciente al más antiguo.

## Capas
- `domain/Signal.ts`: cada señal, su texto en español, su pantalla y el orden de la lista.
- `application/NotificationServices.ts`: los avisos de quien mira y «visto». Los puertos van en `NotificationPorts.ts`.
- Infraestructura: `infrastructure/persistence/sql/SqlNotificationSignals.ts` (una consulta por aviso, solo los permitidos) y `SqlNotificationReads.ts` (`037_notifications.sql`).
- API: `GET /notifications` y `POST /notifications/seen` (`apps/api/routes/routeNotificationsRequest.ts`, que decide qué avisos ve cada rol).

## No le pertenece
- El bloque de flujo **Notificación**, que avisa por WhatsApp a alguien del equipo (`contracts/NotificationConfig.ts`).
- Los datos de cada módulo: solo los lee.

## Pruebas
`tests/unit/notificationFeed.test.ts`, `tests/security/routeNotifications.test.ts`, `tests/integration/notificationsPersistence.test.ts` y `apps/web/tests/components/SidebarActions.test.tsx`.
