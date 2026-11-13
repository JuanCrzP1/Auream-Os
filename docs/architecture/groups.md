# Grupos y comunidades

**Grupos y comunidades** (`/groups`): grupos de WhatsApp que venden. El enlace público de cada campaña es `/g/<slug>`.

| Pieza | Dónde vive |
|---|---|
| Dominio | [`domains/groups`](../../domains/groups/README.md) |
| WhatsApp | `infrastructure/whatsapp/uazapi/UazapiGroupClient.ts`, `parseUazapiGroups.ts` |
| Web | `apps/web/src/features/groups` |

## Lo que da valor

FunnelChat es la referencia del sector: un enlace que crea el grupo siguiente cuando uno se llena, y envíos a muchos grupos. Auream hace eso y suma lo que ellos no muestran: **cuánto vende cada grupo y cada campaña**, conectado al CRM y con envío seguro.

## Campañas y el enlace único

- **Una campaña** tiene:
  - nombre y enlace (`slug`, único en toda la plataforma: el enlace es público);
  - los números que crean los grupos, que se turnan;
  - un cupo por grupo (1.000 por defecto; WhatsApp admite 1.024);
  - la plantilla de cada grupo: nombre « #n», foto, descripción, «solo administradores escriben» y «solo administradores editan»;
  - las reglas automáticas.
- **`GET /g/<slug>[?src=instagram]`**, sin sesión:
  - Lleva (302) al grupo de menor número con cupo y enlace, y anota el clic con su origen.
  - Si no hay ninguno, lo crea en el momento.
  - Si la campaña no existe (404), está cerrada (410) o no hay grupo disponible (503), muestra una página corta en español.
  - Tiene un límite por IP, para que nadie infle los clics.
- **El grupo siguiente** se crea cuando el actual llega al **90 % del cupo** (`groups.prepare`). Sale por el número que le toca, con el nombre « #n», la descripción, la foto (JPEG de 640×640) y las reglas, y se guarda su enlace de invitación.
  - Una posición única por campaña: si dos procesos lo intentan a la vez, se guarda uno solo.
- **Editar la campaña** lleva los cambios a todos sus grupos (`groups.apply`).
- **Apagar el enlace:** deja de recibir gente.
- **El menú «⋯» de cada grupo** (en la campaña, solo con `groups.manage`):
  - **Copiar el enlace de este grupo:** el `inviteLink` guardado; la API solo lo entrega si el número conectado administra el grupo.
  - **Enviar solo a este grupo:** abre «Enviar a grupos» con ese grupo elegido (`?view=send&to=<campaña>&group=<grupo>` → `groupIds`).
  - **Sacar de la campaña** (con confirmación): `PATCH /groups/list/:id` con `campaignId: null`. El grupo sigue en WhatsApp; se puede volver a sumar desde «Mis grupos».
  - Pendiente: ver los miembros de un grupo (necesita un endpoint nuevo).
- **El cupo** se escribe libre y se ajusta a 20–1.024 al salir del campo, no mientras se escribe.

## Mis grupos

- Se traen de WhatsApp (`POST /group/list`, con miembros) los grupos de cada número por QR conectado:
  - al tocar «Traer de WhatsApp»;
  - al crear una campaña;
  - y cada 30 minutos mientras haya campañas activas (`groups.sync`).
- Los que ya no aparecen quedan marcados, no se borran.
- Las comunidades no se manejan todavía.
- Un grupo que ya existía y que administras se puede sumar a una campaña (al final de la fila).

## Lo automático (avisos `groups` de uazapi)

- **Entradas y salidas:** quedan en `wa_group_members`.
  - El aviso no se reintenta si se pierde; la sincronización periódica corrige el conteo.
  - Los miembros que solo traen identificador anónimo (`@lid`) se cuentan, pero sin teléfono no se cruzan con ventas.
- **Etiqueta al entrar:** el contacto queda con el nombre de la campaña, igual que si lo hubiera puesto un flujo (aparece en el CRM).
- **Bienvenida agrupada:** un solo mensaje por tramo de N minutos, que menciona a los que entraron («¡Bienvenidos @Laura, @Andrés y 12 más!»). Se marca antes de enviar, para no saludar dos veces.

## Enviar a grupos

- **Qué:** texto, foto, video, nota de voz o encuesta.
- **A quién:** a campañas enteras o a grupos sueltos que tus números administran.
- **Cuándo:** ahora o programado.
- **«Avisar a todos»:** usa `mentions: "all"` de uazapi. Les llega como mención aunque tengan el grupo silenciado, sin listar nombres.
- **Cómo sale:** grupo por grupo (`groups.post`), por el número que administra cada uno, con **10 a 30 s al azar** entre grupos. Se puede cancelar lo que falta.

## Resultados

Se leen de donde viven (`SqlGroupResults`):

| Dato | De dónde |
|---|---|
| Clics | `group_link_clicks` |
| Entraron / salieron | `wa_group_members` (solo entradas por aviso, no las de la primera sincronización) |
| Compraron y plata | Ventas aprobadas de alguien que **estaba en el grupo cuando compró** (por su teléfono). Cada venta cuenta una vez por grupo y una vez por campaña |

## Permisos

| | Dueño | Administrador | Asesor | Solo lectura |
|---|---|---|---|---|
| Ver campañas, grupos y resultados (`groups.read`) | ✓ | ✓ | ✓ | ✓ |
| Crear, editar, sincronizar, enviar (`groups.manage`) | ✓ | ✓ | — | — |

## API

| Ruta | Permiso |
|---|---|
| `GET /groups` · `GET /groups/list` · `GET /groups/campaigns/:id` | `groups.read` |
| `POST /groups/campaigns` · `PUT /groups/campaigns/:id` · `POST /groups/campaigns/:id/open\|close` | `groups.manage` |
| `POST /groups/sync` · `PATCH /groups/list/:id` · `POST /groups/posts` · `POST /groups/posts/:id/cancel` | `groups.manage` |
| `GET /g/:slug` | público (límite por IP) |

En Vercel, `/g/(.*)` se reescribe a la función de la API (`vercel.json`).

## Datos

`035_groups.sql` es aditiva y crea:
- `group_campaigns`
- `wa_groups`
- `wa_group_members`
- `group_link_clicks`
- `group_posts`
- `group_post_deliveries`

## Pruebas

**Backend:**
- `tests/unit/groupRules.test.ts`
- `tests/unit/groupEngine.test.ts`
- `tests/security/routeGroups.test.ts`
- `tests/integration/groupsPersistence.test.ts` (PostgreSQL real)

**Web:**
- `apps/web/tests/components/GroupsPage.test.tsx`

## Segunda etapa

- Responder los chats de los grupos desde la bandeja.
- Comunidades (`/community/create`, `/community/editgroups`).
- Mensaje privado al entrar, con ritmo seguro.
- Sacar a quien no compró al cerrar.
- Grupos por la API oficial.
