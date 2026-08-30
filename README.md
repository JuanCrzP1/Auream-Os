# AUREAM OS

**AI Agents · Flows · Conversations**

> La plataforma inteligente para automatizar conversaciones y procesos.

---

## Descripción

Plataforma SaaS conversacional multi-tenant: motor de flows conversacionales versionado, builder visual drag-and-drop y runtime de ejecución desacoplado.

El objetivo no es únicamente un constructor de bots, sino una plataforma operacional completa: automatizaciones visuales, conversaciones, conexiones de canal, integraciones, contactos, equipo y facturación, con aislamiento real por tenant.

> **Estado del proyecto.** La base arquitectónica está cerrada, el builder de automatizaciones es funcional de punta a punta y la identidad/tenancy está implementada sobre Neon. El resto de áreas son fronteras arquitectónicas preparadas, sin implementación. Cada sección marca explícitamente `IMPLEMENTADO`, `PREPARADO` o `NO IMPLEMENTADO`.
>
> **Lo más importante que debes saber:** el Flow Engine hoy **sólo se ejecuta en simulación**, desde el builder. No existe todavía ningún emisor de eventos externos, así que un flow publicado no se dispara solo.

---

## Arquitectura general

Monorepo con capas planas y fronteras explícitas:

```
apps/              aplicaciones desplegables (api, worker, web)
domains/           bounded contexts de negocio
flow-engine/       motor de ejecución de automatizaciones
ai-sales-engine/   motor de ventas conversacionales con IA (reservado)
platform/          capacidades transversales
infrastructure/    implementaciones concretas (adapters)
contracts/         contratos de frontera — fuente única
config/            configuración técnica compartida
scripts/           tooling operativo
docs/              documentación de arquitectura y desarrollo
tests/             pruebas que cruzan fronteras
data/              datos locales de runtime (no versionado)
```

Los **dos motores viven en la raíz**, no bajo `domains/`: `domains/` contiene productos de negocio, y un motor es una pieza técnica independiente con su propio ciclo de vida.

Empieza por [`structure.md`](docs/architecture/structure.md) y [`dependency-rules.md`](docs/architecture/dependency-rules.md).

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | TypeScript sobre `node:http` — sin framework |
| Frontend | React 18 + Vite + React Router |
| Canvas del builder | React Flow (`@xyflow/react`) |
| Base de datos | PostgreSQL sobre Neon (driver `pg`) |
| Identidad | Neon Auth — proveedor `better_auth` |
| Tests | Vitest + Testing Library |

---

## Desarrollo local

Requisitos: Node.js y npm en el PATH.

### Windows

Doble clic en [`scripts\dev\start.bat`](scripts/dev/start.bat), o desde consola (CMD o PowerShell) en la raíz del repo:

```
scripts\dev\start.bat
```

### macOS / Linux

```bash
chmod +x scripts/dev/start.sh   # solo la primera vez, si el script no tiene permiso de ejecución
./scripts/dev/start.sh
```

Ambos scripts instalan dependencias si faltan, compilan backend y frontend, y levantan la API (`http://localhost:3100`) y el builder visual (`http://localhost:5173`) en segundo plano, abriendo el navegador automáticamente.

> **Abre siempre `http://localhost:5173`, nunca `http://127.0.0.1:5173`.** Neon Auth confía en `localhost` pero rechaza `127.0.0.1` con `INVALID_ORIGIN`, así que la aplicación cargaría pero el inicio de sesión fallaría. Es el único origen de desarrollo soportado, a propósito.

> Si al clonar o copiar el repo aparece `permission denied` al ejecutar `start.sh`, o `npm run check` falla con `Permission denied` en `node_modules/.bin/tsc`, es porque el sistema de archivos de origen no preservó los bits de ejecución. Solución: `chmod +x scripts/dev/start.sh` y, si persiste en `node_modules`, reinstala con `rm -rf node_modules apps/web/node_modules && npm install && npm --prefix apps/web install`.

### Arranque manual

```bash
npm install
npm run check        # typecheck backend
npm run build        # compila backend
npm run start:api    # API
npm run dev:web      # frontend en modo desarrollo
```

Guía ampliada en [`docs/development/README.md`](docs/development/README.md).

---

## Configuración de entornos

Copia [`.env.example`](.env.example) a `.env` y complétalo. **No hay ninguna credencial hardcodeada en el repositorio** y `.env` está fuera del control de versiones.

### Backend — `apps/api`

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Connection string de Postgres de la rama de este entorno. |
| `NEON_AUTH_URL` | Sí | Proveedor de identidad de este entorno. |
| `NEON_AUTH_ISSUER` | Sí | Emisor exigido en el JWT. Sin él, un token de otra rama sería aceptado. |
| `NEON_AUTH_AUDIENCE` | No | Audiencia exigida. Por defecto, el propio issuer. |
| `NEON_AUTH_JWKS_URL` | No | Endpoint del JWKS. Por defecto se deriva de `NEON_AUTH_URL`. |
| `CORS_ALLOWED_ORIGINS` | Sí en producción | Lista separada por comas. **No existe CORS abierto.** |
| `PORT` | No | Puerto de la API. Por defecto `3100`. |
| `DEV_API_KEY` | No | API key de desarrollo; debe empezar por `bfk_`. **La API se niega a arrancar si está definida con `NODE_ENV=production`.** |
| `DEV_TENANT_ID` | No | Tenant asociado a la API key de desarrollo. Por defecto `test-tenant`. |
| `DATA_DIR` | No | Directorio de persistencia JSON (sólo desarrollo local). |
| `NODE_ENV` | No | `development` o `production`. |

La API **no firma tokens**: los emite y firma Neon Auth, así que no necesita ningún secreto propio.

### Frontend — `apps/web`

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_NEON_AUTH_URL` | Sí | URL del proveedor de identidad para el navegador. |
| `VITE_API_BASE_URL` | Sí en producción | URL de la API. En desarrollo cae a `http://localhost:3100`. |
| `VITE_DEV_API_KEY` | No | Debe coincidir con `DEV_API_KEY`. Sólo se lee en modo desarrollo; nunca se compila en un build de producción. |

---

## TEST vs PRODUCTION

El proyecto usa **dos ramas de Neon separadas**, con base de datos y proveedor de identidad propios cada una:

| Rama | Uso |
|---|---|
| `test` | Desarrollo local y suite de integración. Es la única que recibe datos de prueba. |
| `production` | Despliegue real. **Nunca** recibe pruebas automáticas. |

Los tests de integración leen [`.env.test`](.env.test.example) y usan variables **propias** (`TEST_DATABASE_URL`, `TEST_NEON_AUTH_URL`), sin fallback a las de producción. Antes de abrir una conexión o crear un usuario, el setup global comprueba el **host real** de ambos destinos y aborta la suite entera si no son los de la rama `test` — la comprobación es por host, no por el nombre de la variable, así que una variable mal configurada se detecta igual.

Las ramas heredan la misma clave JWKS del padre, así que la firma no las distingue: lo que las separa es `iss`/`aud`, que el verificador valida obligatoriamente. Un token de `test` presentado a la API de producción se rechaza con 401.

Migraciones:

```bash
npm run db:migrate:test                 # rama test
npm run db:migrate:prod                 # exige --confirm-production
npm run db:seed:test                    # datos de desarrollo en test
```

---

## Auth / Identity / Tenancy

Quién eres lo decide Neon Auth. Dónde estás y qué puedes hacer lo decide esta plataforma.

| Responsabilidad | Dueño |
|---|---|
| Registro, login, contraseñas, recuperación, sesión | Neon Auth |
| Emisión de JWT y JWKS | Neon Auth |
| Verificación del JWT | `platform/identity` |
| Tenant y membership | `platform/tenancy` + `domains/team` |
| Rol y scopes | `platform/authorization` |

**Los scopes nunca viajan en el JWT.** Se derivan en servidor del rol de la membership activa, así que revocar un rol surte efecto en la petición siguiente. El cliente envía `X-Tenant-Id` como **selección**, no como afirmación: el servidor la valida contra una membership activa antes de aceptarla.

Detalle completo en [`auth.md`](docs/architecture/auth.md) y [`tenancy.md`](docs/architecture/tenancy.md).

---

## Testing

```bash
npm test                 # backend: unitarios, contrato y seguridad
npm run test:web         # frontend: componentes, rutas y sesión
npm run test:integration # contra la rama test de Neon — datos reales
```

`tests/` contiene lo que cruza fronteras: `contract/`, `security/`, `unit/`, `integration/` y `fixtures/`. Los tests del frontend viven en `apps/web/tests/`.

Los tests de integración crean usuarios reales en la rama `test` y **los borran siempre**, pase o falle la suite.

---

## Build

```bash
npm run check      # typecheck backend
npm run check:web  # typecheck frontend
npm run build      # backend  → dist/
npm run build:web  # frontend → apps/web/dist/
```

---

## Reglas de código innegociables

1. **Un archivo = una responsabilidad principal.**
2. **Ningún archivo `.ts`/`.tsx` supera 200 líneas.** Un `.css` que los supere debe revisarse por mezcla de responsabilidades.
3. `contracts/` es la **fuente única** de los contratos compartidos. Prohibido duplicarlos, también en el frontend.
4. Un dominio nunca importa una implementación concreta de `infrastructure`; depende de puertos.
5. Un dominio no importa otro dominio; se comunican por contratos o puertos.
6. `apps/` solo compone y expone; no contiene reglas de negocio.
7. `platform/` es transversal y no contiene lógica de ningún dominio.
8. `shared` (frontend) exige dos o más consumidores; con uno solo, el código pertenece a esa feature.
9. Toda entidad de negocio pertenece a un tenant; los puertos de repositorio exigen `tenantId`.
10. **No se finge funcionalidad.** Si una integración no existe, el código falla de forma explícita en lugar de devolver un resultado inventado.

Detalle normativo en [`dependency-rules.md`](docs/architecture/dependency-rules.md).

---

## Contratos canónicos

`contracts/` es la única ubicación de los contratos de frontera:

| Archivo | Contenido |
|---|---|
| `FlowSnapshot.ts` | Modelo de grafo: `NodeType`, `FlowNode`, `FlowEdge`, `FlowSnapshot` y sus variantes de builder |
| `RuntimeContracts.ts` | Ejecución y mensajería: `Session`, `InboundEnvelope`, `NodeExecutionResult` |
| `BuilderContracts.ts` | Capa de aplicación del editor: `PersistedBuilderWorkspace` |
| `TriggerContracts.ts` | Disparo: `ExternalEvent`, `TriggerBinding` — `PREPARADO` |
| `AutomationContracts.ts` | API de Automations: `AutomationSummary`, `AutomationListResponse` |
| `TenancyContracts.ts` | Tenancy expuesta al cliente: `TenantMembershipSummary`, `MyTenantsResponse` |

**El frontend los consume directamente** mediante el alias `@contracts/*`. No existe una copia paralela en `apps/web`.

Un contrato de API **no es** la entidad de dominio. `AutomationSummary` (lo que viaja por HTTP) aplana las fechas y omite `tenantId`; `AutomationFlow` (dominio) conserva ambos. La traducción ocurre en un único punto: `apps/api/http/toAutomationListResponse.ts`.

---

## Frontend — `apps/web`

`IMPLEMENTADO` React + Vite + React Router. El canvas del builder usa React Flow.

```
apps/web/src/
├── app/        composición global: App, router, navegación del sidebar
├── features/   una carpeta por área de producto
└── shared/     lo transversal a 2+ features
```

Cada feature es **dueña de su propio CSS** y lo importa desde su componente. En `shared/styles` sólo vive lo realmente global: el reajuste base, los estilos de elementos nativos y los design tokens (`tokens/`), separados en escalas sin color y una paleta por tema.

| Área | Estado |
|---|---|
| Autenticación (login, registro, recuperación de contraseña) | `IMPLEMENTADO` |
| Automatizaciones (hub + builder visual) | `IMPLEMENTADO` |
| Conexiones, AI Agents | `PREPARADO` — página placeholder |
| Dashboard, Conversaciones, Contactos, Integraciones, Equipo, Facturación, Perfil, Configuración, Ayuda | `NO IMPLEMENTADO` — la ruta del sidebar redirige a Automatizaciones |

Detalle en [`frontend.md`](docs/architecture/frontend.md).

---

## Backend — `apps/api`, `apps/worker`

`IMPLEMENTADO` Servidor HTTP sobre `node:http`, sin framework. `apps/api` solo compone y expone; la lógica vive en `domains/`.

```
apps/api/
├── main.ts        entrypoint: config → composición → listen
├── config/        lectura y validación de entorno
├── composition/   composition root, un archivo por área
├── bootstrap/     construcción del servidor HTTP
├── middleware/    CORS por allowlist, autenticación, resolución de tenant
├── routes/        un router por área
├── handlers/      un handler por caso de uso
└── http/          serialización y mapeo de errores
```

Endpoints: `GET /health`, `GET /me/tenants`, `POST /me/onboarding`, `GET /automations`, `PATCH|DELETE /automations/:id`, y bajo `/api/builder/flows/:flowKey` → `workspace`, `draft`, `publish`, `rollback`, `simulate`.

`NO IMPLEMENTADO` `apps/worker` no procesa nada todavía: no existe cola, así que las sesiones en estado `delayed` no se reanudan y no hay reintentos.

Detalle en [`backend.md`](docs/architecture/backend.md).

---

## Domains

| Dominio | Estado | Contenido |
|---|---|---|
| `automations` | `IMPLEMENTADO` | El producto: catalog, builder, validation |
| `sessions` | `IMPLEMENTADO` | Estado de ejecución: sesión y contexto de runtime |
| `team` | `IMPLEMENTADO` | `Membership` y alta inicial, persistidos en SQL |
| `billing` | `PREPARADO` | Planes, suscripciones, límites y capacidades — sin conectar a la API |
| `analytics` | `PREPARADO` | Registro de eventos operativos en memoria |
| `conversations`, `contacts`, `connections`, `integrations`, `ai-agents` | `NO IMPLEMENTADO` | Frontera de carpeta, sin código |

El versionado y la publicación viven en `automations/builder` (`PublishDraftService`, `createVersionedBuilderSnapshot`).

---

## Motores

| Motor | Qué ejecuta | Quién lo administra | Estado |
|---|---|---|---|
| `flow-engine/` | Grafos de automatización versionados | `domains/automations` | `IMPLEMENTADO` (sólo en simulación) |
| `ai-sales-engine/` | Conversaciones de venta con IA | `domains/ai-agents` | `NO IMPLEMENTADO` — carpeta reservada y vacía |

**Producto ≠ motor.** `automations` administra y construye; `flow-engine` ejecuta.

**El handoff pertenece exclusivamente al AI Sales Engine.** El Flow Engine no tiene nodo `handoff` ni estado `handed_off`: derivar a un asesor humano es una decisión comercial, no un paso de un grafo determinístico.

`sessions` es el estado de ejecución del runtime; `conversations` será el inbox operacional. Son contextos distintos y no deben mezclarse.

---

## Platform

| Capacidad | Estado |
|---|---|
| `identity` — verificación de JWT contra el JWKS de Neon Auth y de API key | `IMPLEMENTADO` |
| `authorization` — roles, scopes, policies, guards | `IMPLEMENTADO` |
| `tenancy` — resolución de tenant y contexto de petición | `IMPLEMENTADO` — validado contra membership activa |
| `observability` — logging estructurado | `IMPLEMENTADO` (`RequestLogger`, `ErrorLogger` conectados) |
| `observability` — auditoría, métricas, tracing, `AccessLogger`, `RuntimeLogger` | `PREPARADO` — sin consumidor |
| `security` — rate limiting | `PREPARADO` — implementado y probado, no conectado a la API |
| `configuration` | `NO IMPLEMENTADO` |

**Usage no vive en `platform/`.** Medir consumo alimenta límites y entitlements, así que pertenece a `domains/billing`.

---

## Infrastructure

| Adapter | Estado |
|---|---|
| `persistence/sql` — tenants, memberships, onboarding y migraciones | `IMPLEMENTADO` |
| `persistence/json` — workspaces, automatizaciones, carpetas | `IMPLEMENTADO` — **sólo desarrollo local** |
| `persistence/memory` — registries y repositorios en memoria | `IMPLEMENTADO` — simulación y tests |
| `identity/HttpJwksKeyStore` — descarga de claves públicas | `IMPLEMENTADO` |
| `cache`, `queue`, `storage`, `providers` | `NO IMPLEMENTADO` |

La persistencia de producción es **SQL sobre Neon**. Neon no aparece en ningún dominio: el adaptador vive en `persistence/sql/` y la elección se hace en un único punto, `apps/api/composition/`. Ver [`persistence.md`](docs/architecture/persistence.md).

---

## Datos locales

`data/builder-workspaces/<tenantId>/` guarda los workspaces del builder en JSON. Es **datos de runtime escritos por la aplicación**, no fixtures: está fuera del control de versiones. Los fixtures de prueba viven en `tests/fixtures/`.

---

## Documentación relacionada

| Documento | Contenido |
|---|---|
| [`vision.md`](docs/architecture/vision.md) | Visión de producto y alcance |
| [`structure.md`](docs/architecture/structure.md) | Estructura del monorepo |
| [`dependency-rules.md`](docs/architecture/dependency-rules.md) | Reglas de dependencia entre capas |
| [`boundaries.md`](docs/architecture/boundaries.md) | Fronteras entre bounded contexts |
| [`auth.md`](docs/architecture/auth.md) | Autenticación, identidad y sesión |
| [`tenancy.md`](docs/architecture/tenancy.md) | Multi-tenancy y memberships |
| [`persistence.md`](docs/architecture/persistence.md) | Persistencia y adaptadores |
| [`backend.md`](docs/architecture/backend.md) | API y composición |
| [`frontend.md`](docs/architecture/frontend.md) | Aplicación web |
| [`automations.md`](docs/architecture/automations.md) | Dominio de automatizaciones |
| [`flow-engine.md`](docs/architecture/flow-engine.md) | Motor de ejecución |
| [`ai-sales-engine.md`](docs/architecture/ai-sales-engine.md) | Motor de ventas con IA |
| [`ai-agents.md`](docs/architecture/ai-agents.md) | Dominio de agentes |
| [`docs/development/README.md`](docs/development/README.md) | Guía de desarrollo local |
