# Bots AI Platform

Plataforma SaaS conversacional multi-tenant: motor de flows conversacionales versionado, builder visual drag-and-drop y runtime de ejecución desacoplado.

El objetivo no es únicamente un constructor de bots, sino una plataforma operacional completa: automatizaciones visuales, conversaciones, conexiones de canal, integraciones, contactos, equipo y facturación, con aislamiento real por tenant.

> **Estado del proyecto.** La base arquitectónica está cerrada y el builder de automatizaciones es funcional de punta a punta. El resto de áreas son fronteras arquitectónicas preparadas, sin implementación. Cada sección marca explícitamente `IMPLEMENTADO`, `PREPARADO` o `NO IMPLEMENTADO`.
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

Cada feature es **dueña de su propio CSS** y lo importa desde su componente. En `shared/styles` sólo quedan `base.css` y `theme.css`, que son realmente globales.

| Área | Estado |
|---|---|
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
├── middleware/    CORS por allowlist, autenticación
├── routes/        un router por área
├── handlers/      un handler por caso de uso
└── http/          serialización y mapeo de errores
```

Endpoints: `GET /health`, `GET /automations`, `PATCH|DELETE /automations/:id`, y bajo `/api/builder/flows/:flowKey` → `workspace`, `draft`, `publish`, `rollback`, `simulate`.

`NO IMPLEMENTADO` `apps/worker` no procesa nada todavía: no existe cola, así que las sesiones en estado `delayed` no se reanudan y no hay reintentos.

Detalle en [`backend.md`](docs/architecture/backend.md).

---

## Domains

| Dominio | Estado | Contenido |
|---|---|---|
| `automations` | `IMPLEMENTADO` | El producto: catalog, builder, validation |
| `sessions` | `IMPLEMENTADO` | Estado de ejecución: sesión y contexto de runtime |
| `team` | `PREPARADO` | Modelo `Membership`: qué usuario pertenece a qué tenant con qué rol |
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
| `identity` — verificación JWT y API key | `IMPLEMENTADO` |
| `identity` — modelo `User` | `PREPARADO` — contrato sin persistencia |
| `authorization` — roles, scopes, policies, guards | `IMPLEMENTADO` |
| `observability` — logging estructurado | `IMPLEMENTADO` (`RequestLogger`, `ErrorLogger` conectados) |
| `observability` — auditoría, métricas, tracing, `AccessLogger`, `RuntimeLogger` | `PREPARADO` — sin consumidor |
| `security` — rate limiting | `PREPARADO` — implementado y probado, no conectado a la API |
| `tenancy` — resolución y contexto de tenant | `PREPARADO` — sólo `StaticTenantResolver` |
| `tenancy` — modelo `Tenant` | `PREPARADO` — contrato sin persistencia |
| `configuration` | `NO IMPLEMENTADO` |

**Usage no vive en `platform/`.** Medir consumo alimenta límites y entitlements, así que pertenece a `domains/billing`.

---

## Infrastructure

| Adapter | Estado |
|---|---|
| `persistence/json` — workspaces, automatizaciones, carpetas | `IMPLEMENTADO` — **sólo desarrollo local** |
| `persistence/memory` — registries y repositorios en memoria | `IMPLEMENTADO` — simulación y tests |
| `persistence/sql` | `NO IMPLEMENTADO` — destino de producción |
| `cache`, `queue`, `storage`, `providers` | `NO IMPLEMENTADO` |

La persistencia de producción será **SQL sobre Neon**. Neon no aparece en ningún dominio: el adaptador vive en `persistence/sql/` y la elección se hace en un único punto, `apps/api/composition/composeBuilderServices.ts`. Ver [`persistence.md`](docs/architecture/persistence.md).

---

## Ejecución local

Requisitos: Node.js y npm en el PATH.

```
scripts\dev\start.bat        # Windows
./scripts/dev/start.sh       # macOS / Linux
```

Arranque manual:

```bash
npm install
npm run check        # typecheck backend
npm run build        # compila backend
npm run start:api    # requiere JWT_SECRET
npm run dev:web      # frontend en modo desarrollo
```

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` | Sí | Secreto de firma, mínimo 32 caracteres. La API no arranca sin él. |
| `CORS_ALLOWED_ORIGINS` | Sí en producción | Lista separada por comas. **No existe CORS abierto.** |
| `PORT` | No | Puerto de la API. Por defecto `3100`. |
| `DEV_API_KEY` | No | API key de desarrollo; debe empezar por `bfk_`. **La API se niega a arrancar si está definida con `NODE_ENV=production`.** |
| `DEV_TENANT_ID` | No | Tenant asociado a la API key de desarrollo. Por defecto `test-tenant`. |
| `VITE_API_BASE_URL` | Sí en producción (web) | URL de la API para el frontend. |
| `VITE_DEV_API_KEY` | No (web) | Sólo se lee en modo desarrollo; nunca se compila en un build de producción. |

**No hay ninguna credencial hardcodeada** en el repositorio.

---

## Tests

```bash
npm test         # backend  (207 tests)
npm run test:web # frontend (77 tests)
```

`tests/` contiene lo que cruza fronteras: `contract/`, `security/`, `unit/` y `fixtures/`. Los tests del frontend viven en `apps/web/tests/`.

---

## Build

```bash
npm run build      # backend → dist/
npm run build:web  # frontend → apps/web/dist/
```

---

## Datos locales

`data/builder-workspaces/<tenantId>/` guarda los workspaces del builder en JSON. Es **datos de runtime escritos por la aplicación**, no fixtures: está fuera del control de versiones. Los fixtures de prueba viven en `tests/fixtures/`.
