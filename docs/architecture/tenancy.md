# Multi-tenancy

El tenant es una frontera transversal, no un dominio. Toda entidad de negocio pertenece a un tenant y ningún dato cruza esa línea.

Este documento describe lo que existe hoy. Lo pendiente aparece marcado como tal.

## Piezas

| Pieza | Ubicación | Estado |
|---|---|---|
| Verificación de identidad (JWT/JWKS, Neon Auth) | `platform/identity` | `IMPLEMENTADO` |
| Roles, scopes, policies, guards | `platform/authorization` | `IMPLEMENTADO` |
| Aislamiento en persistencia SQL (tenants, memberships) | `infrastructure/persistence/sql` | `IMPLEMENTADO` |
| Aislamiento en persistencia JSON (automations) | `infrastructure/persistence/json` | `IMPLEMENTADO` |
| Alta inicial de tenant (onboarding transaccional e idempotente) | `domains/team` | `IMPLEMENTADO` |
| Resolver de tenant para el runtime de simulación | `platform/tenancy` (`TenantResolver`) | `PREPARADO` — ver «Pendiente» |
| Identidad de usuario | `platform/identity/contracts/UserIdentity.ts` | `IMPLEMENTADO` (vía Neon Auth; sin tabla propia — sólo `actorId`) |
| Modelo `Tenant` | `platform/tenancy/contracts/Tenant.ts` | `IMPLEMENTADO` |
| Modelo `Membership` | `domains/team/contracts/Membership.ts` | `IMPLEMENTADO` |
| Límites por plan | `domains/billing` | `PREPARADO` |
| Medición de consumo | `domains/billing` | `NO IMPLEMENTADO` |

## La cadena de identidad

```
USER          quién es la persona          platform/identity/contracts/UserIdentity.ts
  ↓
MEMBERSHIP    dónde y con qué rol          domains/team/contracts/Membership.ts
  ↓
TENANT        la organización              platform/tenancy/contracts/Tenant.ts
  ↓
ROLE          qué significa ese rol        platform/authorization/contracts/Role.ts
  ↓
SCOPES        qué permite                  platform/authorization/roles/RoleDefinitions.ts
  ↓
RESOURCE      sobre qué                    guards + policies
```

**Un usuario puede pertenecer a varios tenants con roles distintos:**

```
User A ├── Tenant A → tenant_owner
       └── Tenant B → operator
```

### Reparto de responsabilidades

| Concepto | Dónde vive | Por qué |
|---|---|---|
| `UserIdentity` | `platform/identity` | Es identidad de plataforma, no de tenant: sólo `actorId`. No lleva rol, permisos, tenant ni facturación — eso se resuelve después contra `memberships`. |
| `Tenant` | `platform/tenancy` | La unidad de aislamiento es transversal a todos los dominios. |
| `Role` + scopes | `platform/authorization` | Define **qué significa** un rol. Política de acceso, transversal. |
| `Membership` | `domains/team` | Define **quién tiene cuál rol en qué tenant**. Es negocio del equipo, no política. |

Esa última división es deliberada: si la pertenencia viviera en `authorization`, la capa de política acabaría gestionando invitaciones, altas y bajas de personas — responsabilidades de producto que no le corresponden.

### Dos formas de identidad autenticada, a propósito

`AuthenticatedPrincipal` distingue explícitamente dos clases (`platform/identity/contracts/AuthenticatedPrincipal.ts`):

- **Usuario humano** (`kind: "user"`) → `UserIdentity { actorId }`. Sólo dice quién es; tenant y scopes se resuelven después contra `memberships`, en cada petición.
- **Máquina** (`kind: "machine"`, API key) → `AuthIdentity { tenantId, actorId, scopes }`. Ya trae tenant y scopes fijos de origen, porque no hay una persona detrás eligiendo tenant.

`actorId` es deliberadamente polimórfico en ambos casos: puede ser un usuario, un cliente de API o un worker (ver `Role`).

**Estado:** `Tenant` y `Membership` tienen persistencia real en SQL; la identidad de usuario la resuelve Neon Auth por completo, sin tabla propia. `tests/security/membershipModel.test.ts` verifica que la cadena rol→scopes es completa y que dos memberships del mismo usuario en tenants distintos resuelven a permisos distintos; `tests/integration/tenancyPersistence.test.ts` lo verifica contra Postgres real.

## Resolución del tenant

El `tenantId` nunca es una afirmación del cliente, pero sí puede ser una **selección** explícita: el cliente puede enviar `X-Tenant-Id` para elegir con cuál de sus tenants opera. `resolveRequestContext` (en `apps/api/middleware/`) valida esa selección contra una membership **activa** en base de datos antes de aceptarla — un tenant que el usuario no pertenece, o del que no es miembro activo, se rechaza con 403 aunque lo pida explícitamente. Sin selección y con una sola membership, se resuelve automáticamente; con varias, exige elegir (400). Detalle completo en [`auth.md`](auth.md#selección-de-tenant).

Eso es distinto de "declarar el tenant": el cliente propone, el servidor decide contra la base de datos. Por eso el aislamiento sigue siendo verificable pese a que el header exista.

`platform/tenancy` provee además `TenantResolver`, un concepto **separado**: resuelve el contexto de límites operativos que necesita el runtime de simulación del builder (`BuilderSimulationRuntimeFactory`), no la identidad de una petición HTTP. No debe confundirse con `resolveRequestContext`. Unificar ambos caminos sigue pendiente (ver «Pendiente»).

## Contexto del tenant

`RequestContext` se resuelve una vez por petición en `apps/api` y se pasa explícitamente a los servicios de aplicación. Ningún dominio vuelve a resolverlo por su cuenta.

`TenantContext` (en `contracts/RuntimeContracts`) transporta el tenant y sus límites hacia el runtime de ejecución.

## Autorización

Separada de la identidad a propósito: `identity` responde quién eres, `authorization` responde qué puedes hacer. Cambiar de proveedor de identidad no debería tocar una línea de autorización.

Los guards `requireScope`, `requireRole` y `requireTenantAccess` operan sobre el `RequestContext` ya resuelto. Las rutas del builder usan `requireScope` con los permisos `flows.read`, `flows.write`, `flows.publish` y `runtime.execute`.

## Aislamiento de datos

Los puertos de repositorio exigen `tenantId` en la firma. No existe un `list()` sin tenant, solo `listByTenant(tenantId)`: el aislamiento se impone en el tipo, no en la disciplina de quien llama.

En la implementación JSON cada tenant tiene su propio directorio bajo `data/builder-workspaces/<tenantId>/`. Ese esquema se traduce directamente a una columna `tenant_id` obligatoria e indexada cuando la persistencia pase a SQL, sin que ningún dominio cambie.

## Autenticación en desarrollo

La identidad real (Neon Auth, login/registro, sesión, JWT) es la única vía de autenticación de usuario. Además, `DEV_API_KEY` registra opcionalmente una credencial de **máquina** (`X-Api-Key`) asociada a un tenant fijo — pensada para desarrollo local y scripts, nunca para un usuario humano. La API se niega a arrancar si esa variable está definida con `NODE_ENV=production`. Detalle en [`auth.md`](auth.md).

## Pendiente

- Unificar el resolver de tenant: `resolveRequestContext` deriva el tenant de la membership y `TenantResolver` (límites del runtime de simulación) vive en paralelo con un propósito distinto. Debe evaluarse si conviene un único camino.
- Conectar los límites por tenant: `platform/tenancy` y `domains/billing` los definen, pero ningún endpoint los aplica.
- Añadir medición de consumo en `domains/billing` para que pueda decidir sobre datos reales.
- Ciclo de vida de usuario eliminado en Neon Auth: `memberships.user_id` no tiene FK hacia `neon_auth.user` (decisión deliberada, ver la migración `003_memberships.sql`), así que borrar un usuario desde el dashboard de Neon puede dejar memberships huérfanas. No existe webhook `user.deleted`; queda como requisito explícito de una fase posterior.
- Configuración manual pendiente en el dashboard de Neon para producción (no cambiable por código): `allow_localhost` sigue en `true`, el proveedor OAuth de Google usa la clave compartida de desarrollo de Neon, y el proveedor de email es el compartido de Neon. Verificar con `neonctl neon-auth plugins list --branch production`.
