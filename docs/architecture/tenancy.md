# Multi-tenancy

El tenant es una frontera transversal, no un dominio. Toda entidad de negocio pertenece a un tenant y ningún dato cruza esa línea.

Este documento describe lo que existe hoy. Lo pendiente aparece marcado como tal.

## Piezas

| Pieza | Ubicación | Estado |
|---|---|---|
| Verificación de identidad | `platform/identity` | `IMPLEMENTADO` |
| Roles, scopes, policies, guards | `platform/authorization` | `IMPLEMENTADO` |
| Aislamiento en persistencia | `infrastructure/persistence/json` | `IMPLEMENTADO` |
| Resolver de tenant y límites | `platform/tenancy` | `PREPARADO` |
| Modelo `User` | `platform/identity/contracts/User.ts` | `PREPARADO` |
| Modelo `Tenant` | `platform/tenancy/contracts/Tenant.ts` | `PREPARADO` |
| Modelo `Membership` | `domains/team/contracts/Membership.ts` | `PREPARADO` |
| Límites por plan | `domains/billing` | `PREPARADO` |
| Medición de consumo | `domains/billing` | `NO IMPLEMENTADO` |

## La cadena de identidad

```
USER          quién es la persona          platform/identity/contracts/User.ts
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
| `User` | `platform/identity` | Es identidad de plataforma, no de tenant. No lleva rol, permisos ni facturación. |
| `Tenant` | `platform/tenancy` | La unidad de aislamiento es transversal a todos los dominios. |
| `Role` + scopes | `platform/authorization` | Define **qué significa** un rol. Política de acceso, transversal. |
| `Membership` | `domains/team` | Define **quién tiene cuál rol en qué tenant**. Es negocio del equipo, no política. |

Esa última división es deliberada: si la pertenencia viviera en `authorization`, la capa de política acabaría gestionando invitaciones, altas y bajas de personas — responsabilidades de producto que no le corresponden.

### Por qué `AuthIdentity` no cambia de forma

`AuthIdentity` mantiene `{ tenantId, actorId, scopes }`. El token se emite **para un tenant concreto**, después de resolver la membership elegida; cambiar de tenant será emitir una identidad nueva, no ampliar la existente.

`actorId` es deliberadamente polimórfico: puede ser un usuario, un cliente de API o un worker (ver `Role`). No asumir que siempre es un `User.id`.

**Estado:** los tres modelos son `PREPARADO` — contratos sin persistencia, sin puerto de repositorio y sin caso de uso. `tests/security/membershipModel.test.ts` verifica que la cadena rol→scopes es completa y que dos memberships del mismo usuario en tenants distintos resuelven a permisos distintos.

## Resolución del tenant

Hoy el `tenantId` se deriva de la identidad autenticada, no de la petición. `apps/api` verifica el token o la API key y construye un `RequestContext` que incluye `tenantId`, `actorId` y `scopes`.

El tenant nunca llega por query string, cabecera libre ni cuerpo de la petición. Esa es la regla que hace verificable el aislamiento: si el cliente no puede declarar su tenant, no puede falsificarlo.

`platform/tenancy` provee además `TenantResolver`, que resuelve el contexto de un tenant con sus límites operativos. Hoy solo lo usa el runtime de simulación; la API deriva el tenant de la identidad. Unificar ambos caminos en un único resolver es trabajo pendiente y está anotado como tal.

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

En local la aplicación funciona con una credencial de desarrollo registrada al arrancar la API y una sesión fija en el frontend, ambas asociadas al tenant `test-tenant`.

Es la única autenticación existente y sostiene la aplicación. No es un residuo: es andamiaje deliberado que debe retirarse cuando exista identidad real. Hasta entonces, eliminarla deja la plataforma sin forma de autenticar.

## Pendiente

- Unificar el resolver de tenant: hoy `apps/api` deriva el tenant de la identidad y `TenantResolver` vive en paralelo. Debe quedar un único camino.
- Conectar los límites por tenant: `platform/tenancy` y `domains/billing` los definen, pero ningún endpoint los aplica.
- Sustituir la autenticación de desarrollo por identidad real.
- Añadir medición de consumo en `domains/billing` para que pueda decidir sobre datos reales.
- Persistir `User`, `Tenant` y `Membership`: hoy son modelos conceptuales sin repositorio. Es el primer trabajo de Fase 1.
