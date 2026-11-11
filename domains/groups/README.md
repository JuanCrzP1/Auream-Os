# groups — grupos y comunidades de WhatsApp (bounded context)

Opción de la barra: **Grupos y comunidades** (`/groups`). Web: `apps/web/src/features/groups/`. Diseño: [`docs/architecture/groups.md`](../../docs/architecture/groups.md).

## Responsabilidad
Grupos que venden: campañas con un **enlace único** que lleva al grupo con cupo y crea el siguiente al llenarse, los grupos de cada número, mensajes a muchos grupos, la bienvenida agrupada, la etiqueta al entrar y **lo que vende cada grupo**.

## Le pertenece
- La campaña: enlace (`slug`), números, cupo, plantilla del grupo y reglas (`domain/Campaign.ts`).
- A qué grupo lleva el enlace y cuándo preparar el siguiente (`domain/Rotation.ts`).
- Los envíos a grupos y la bienvenida (`domain/GroupPost.ts`).
- Los grupos guardados, sus miembros (entradas y salidas) y los clics al enlace.

## No le pertenece
- Hablar con WhatsApp: el puerto `GroupGateway`, que cumple uazapi (`infrastructure/whatsapp/uazapi/UazapiGroupClient.ts`) con la sesión de cada número (Conexiones).
- Programar en el tiempo: `domains/scheduling`. Las etiquetas: `domains/contacts`. Las ventas: `domains/sales` (solo se leen).

## Capas
- `domain/`: reglas puras.
- `application/`: `CampaignServices`, `GroupServices` («Mis grupos»), `PostServices` + `PostDispatcher` (envíos), `LinkService` (el enlace público), `GroupMaker` (crear el grupo siguiente), `GroupActivity` (avisos y bienvenida), `GroupSync`. Puertos en `GroupPorts.ts`.
- Persistencia: `infrastructure/persistence/sql/Sql{GroupCampaigns,WaGroups,GroupPosts,GroupResults}.ts` (`035_groups.sql`).
- Composición: `apps/api/composition/composeGroupServices.ts`, `groupGateway.ts`, `groupTaskAdapters.ts`.
