# Equipo: invitar, roles y permisos

**Configuración → Equipo** (`/settings/team`) y la página del enlace (`/invite/:token`). Dominio: [`domains/team`](../../domains/team/README.md) · web: [`features/team`](../../apps/web/src/features/team/README.md).

## Cómo se invita (como Slack, Notion o HubSpot)

1. Quien administra el equipo escribe el correo y elige el rol. Auream crea un **enlace de invitación**.
2. Se lo manda («Copiar» o «Enviar por WhatsApp»). Con el correo propio (FASE H, H2) llegará solo: el envío queda como pieza aparte, sin tocar el resto.
3. La persona abre el enlace y ve la empresa, quién la invita y su rol. **No necesita cuenta previa**: si no tiene, la crea ahí mismo y vuelve al enlace.
4. «Unirme»: entra a la empresa. En `/invite/…` no se crea «Mi espacio» (`ActiveTenantProvider`), así el asesor no queda con una empresa vacía propia.

**Seguridad.** El secreto del enlace son 32 bytes aleatorios; se guarda solo su huella SHA-256 y se muestra una vez. Vence a los 7 días, sirve una sola vez y solo lo acepta quien entra **con el correo invitado** (el que firma Neon Auth en el token, nunca el que mande el cliente): un enlace reenviado por error no le sirve a otro. Abrir el enlace no exige sesión (30 por minuto por IP); aceptar, sí. Invitar de nuevo al mismo correo renueva su invitación (una pendiente por correo y cuenta; tope de 50 vivas por cuenta).

## Roles

| | Dueño (`tenant_owner`) | Administrador (`tenant_admin`) | Asesor (`operator`) | Solo lectura (`viewer`) |
|---|---|---|---|---|
| Conversaciones y contactos | Todo | Todo | Todo | Ver |
| Automatizaciones | Editar | Editar | **Ver** | Ver |
| Ventas y productos | Todo | Todo | **Anotar** | Ver |
| Meta Ads: gasto, ROAS y ganancia (`ads.*`) | Todo | Todo | — | — |
| CRM (embudo y seguimientos) | Todo | Todo | **Atender** (mover, valor, responsable, seguimientos) | Ver |
| Conexiones de WhatsApp | Todo | Todo | Ver | Ver |
| Integraciones (claves, píxeles) | Todo | Todo | — | — |
| Equipo | Todo | Menos dueños | Ver | Ver |
| Datos de la empresa | Todo | Ver | Ver | Ver |

- **Qué significa cada rol** vive en `platform/authorization` (`ROLE_SCOPES`; permisos nuevos `team.read` y `team.manage`, `TeamPermissions`). **A quién puede tocar cada uno** vive en `domains/team/domain/TeamPolicy.ts`.
- Reglas fijas: el dueño da cualquier rol (también dueño); el administrador nunca toca a un dueño ni nombra dueños; nadie cambia su propio rol ni se quita a sí mismo; **siempre queda al menos un dueño**, garantizado dentro de la base (cambiar o quitar a un dueño bloquea las filas de los dueños: dos dueños bajándose a la vez no dejan la cuenta sin ninguno).
- Quitar a alguien revoca su membresía al instante; sus conversaciones y lo que hizo se conservan. Si vuelve con una invitación nueva, la membresía se reactiva con el rol invitado.
- **El Asesor ve las automatizaciones sin editarlas** (decisión del dueño, 2026-11-10): sin `flows.write` ni `credentials.read`. Sigue respondiendo chats y mandando flujos a mano (eso es `conversations.write`).

## La pantalla

Cuatro pestañas (viajan en la dirección, `?tab=`):

- **Miembros**: buscador (sin importar tildes), filtro por rol y la tabla: persona, **última vez** («En línea», «Hace 2 h», «Aún no ha entrado»), desde cuándo está, su rol y el menú ⋯ (cambiar rol o quitar) en quien puedes administrar. Si estás solo, arriba la tarjeta «Trabaja en equipo» con el botón de invitar.
- **Invitaciones**: las pendientes, con «Enlace nuevo» y «Retirar invitación».
- **Roles**: una tarjeta por rol con lo que puede en cada área (la tabla de arriba).
- **Actividad**: quién invitó, entró, cambió un rol, retiró una invitación o quitó a alguien, y cuándo (las últimas 50).

**Invitar a varios a la vez**: los correos se escriben como chips (Enter, coma o espacio; se pegan varios; los que no son correo quedan en rojo; hasta 20) con un mismo rol. Se invitan uno por uno y se muestra el enlace de cada uno, o por qué no se pudo.

**Última vez.** Cada petición de una persona a su cuenta anota `memberships.last_seen_at` en segundo plano (`apps/api/middleware/recordLastSeen.ts`): como mucho una vez por minuto por persona y cuenta (en memoria de la instancia y en la base), sin frenar la respuesta.

**Actividad.** `TeamServices` e `InvitationServices` anotan cada acción en `team_activity` (`TeamActivityLog`); si anotar falla, la acción igual se hace. Los nombres salen de `user_profiles` al leer.

## Lo que ve la web según los permisos

`/me/tenants` trae, por cada cuenta, sus `permissions` (derivados en el servidor de `ROLE_SCOPES`). `useCan(permiso)` (`shared/auth/tenant/usePermissions.ts`) los consulta: solo dice «no» cuando el servidor ya lo confirmó; mientras cargan, «sí» (la API protege igual con 403).

Sin `flows.write`:
- **Automatizaciones** se ven y se abren, sin «Nueva», sin menú de acciones y sin arrastrar.
- **El editor** abre en solo lectura: sin paleta, sin autoguardado, «Solo lectura» en la barra, bloques sin duplicar ni borrar y el editor de cada bloque con los campos apagados y «Cerrar». `useReadOnlyBuilder` blinda el grafo: deja seleccionar y medir, e ignora mover, conectar, borrar, soltar y renombrar.

## Quién es cada miembro

El correo y el nombre con el que se registró los firma Neon Auth en el token. Al abrir la app (`/me/onboarding`) se copian a `user_profiles` (`email`; `display_name` solo si la persona nunca puso uno en Mi perfil). Son datos para mostrar y casar invitaciones; nunca autentican ni autorizan.

## API

| Ruta | Quién | Para qué |
|---|---|---|
| `GET /team` | `team.read` (todo el equipo) | Miembros, invitaciones, tu rol y los roles que puedes dar |
| `POST /team/invitations` | `team.manage` | Invitar (devuelve el enlace una vez) |
| `POST /team/invitations/:id/renew` · `DELETE /team/invitations/:id` | `team.manage` | Enlace nuevo · retirar |
| `PATCH /team/members/:userId` · `DELETE /team/members/:userId` | `team.manage` | Cambiar rol · quitar |
| `GET /team/activity` | `team.read` | Lo último que pasó en el equipo |
| `GET /invitations/:token` | Cualquiera con el enlace | La empresa, quién invita, el rol y el correo a medias |
| `POST /me/invitations/:token/accept` | Con sesión, sin cuenta elegida | Unirse |

Solo personas: una credencial de máquina recibe 403 en `/team`. Base: `029_team_invitations.sql` (`team_invitations` y `user_profiles.email`) y `030_team_activity.sql` (`team_activity` y `memberships.last_seen_at`).

## Pruebas

`tests/unit/teamPolicy.test.ts`, `tests/unit/teamServices.test.ts`, `tests/unit/teamInvitations.test.ts`, `tests/security/routeTeam.test.ts`, `tests/integration/teamPersistence.test.ts` (PostgreSQL real, con dos dueños a la vez), `apps/web/tests/components/TeamSettings.test.tsx` (pestañas, buscador, menú ⋯, invitar a uno y a varios, actividad), `AcceptInvitationPage.test.tsx` y `ReadOnlyAutomations.test.tsx`.

## Después

El CRM ya asigna un responsable a cada cliente (a mano o por turnos); que Conversaciones muestre a cada asesor solo sus chats llega después; el envío por correo, con la FASE H; «Salir del equipo» por cuenta propia, cuando haga falta.
