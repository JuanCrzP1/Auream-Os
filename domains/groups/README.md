# groups — grupos y comunidades de WhatsApp (bounded context)

Opción de la barra: **Grupos y comunidades** (`/groups`). Web: `apps/web/src/features/groups/`.

## Responsabilidad
Los grupos y comunidades de WhatsApp de cada número conectado: verlos, programar mensajes a grupos, dar la **bienvenida** automática a quien entra y manejar los **enlaces de invitación**. Es lo que distingue a FunnelChat y Leona no tiene.

## Le pertenece
- Los grupos sincronizados de cada conexión y sus datos (nombre, miembros, enlace).
- Los mensajes programados a grupos y la regla de bienvenida.

## No le pertenece
- Hablar con WhatsApp: un puerto `WhatsAppGroups` que implementa el proveedor en `infrastructure/whatsapp` (uazapi; luego la API oficial).
- Programar en el tiempo: `domains/scheduling`.

## Depende de (por puertos)
`connections` (qué número), `scheduling` (mensajes programados). Los avisos de miembros nuevos llegan por el webhook del proveedor (`apps/api/routes/routeWhatsAppWebhooks.ts`).

## Capas
`domain/` (Group, ScheduledGroupMessage, WelcomeRule) · `application/` · adaptador en `infrastructure/whatsapp`. API prevista: `/groups`.
