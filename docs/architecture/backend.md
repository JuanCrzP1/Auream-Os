# Backend

Cuatro capas: `apps/` compone y expone, `domains/` decide, `platform/` provee capacidades transversales, `infrastructure/` habla con el exterior.

## apps/api · `IMPLEMENTADO`

Servidor HTTP sobre `node:http`, sin framework. Enrutado manual por coincidencia de ruta y método.

```
apps/api/
├── main.ts        arranque, CORS, autenticación, enrutado
├── composition/   composition root: instanciación e inyección
├── handlers/      un handler por acción
├── http/          helpers de request/response
├── middleware/    autenticación de la petición
└── routes/        enrutado del builder
```

`main.ts` falla al arrancar si falta `DATABASE_URL`, `NEON_AUTH_URL` o `NEON_AUTH_ISSUER` (ver `config/loadDatabaseConfig.ts` y `config/loadNeonAuthConfig.ts`), deliberadamente: es preferible no arrancar a arrancar sin poder resolver tenancy o verificar identidad. La API **no firma tokens** — los emite y firma Neon Auth — así que no necesita ningún secreto propio de firma.

### Endpoints

| Método | Ruta | Scope |
|---|---|---|
| `GET` | `/health` | público |
| `GET` | `/me/tenants` | identidad de usuario, sin tenant |
| `POST` | `/me/onboarding` | identidad de usuario, sin tenant |
| `GET` `PATCH` | `/me/profile` · `POST` `/me/profile/photo/uploads` · `PUT` `DELETE` `/me/profile/photo` (Mi perfil) | identidad de usuario, sin tenant |
| `GET` | `/company` (Empresa: nombre, logo y zona horaria) | miembro de la cuenta |
| `PATCH` | `/company` · `POST` `/company/logo/uploads` · `PUT` `DELETE` `/company/logo` | `tenant.manage` |
| `GET` | `/automations` | `flows.read` |
| `POST` | `/automations` (crear; el id lo decide el servidor) | `flows.write` |
| `PATCH` `DELETE` | `/automations/:id` | `flows.write` |
| `POST` | `/automations/:id/duplicate` | `flows.write` |
| `PATCH` | `/automations/:id/archive` | `flows.write` |
| `PATCH` | `/automations/:id/folder` | `flows.write` |
| `POST` | `/automations/folders` · `PATCH` `/automations/folders/:id` | `flows.write` |
| `GET` | `/api/builder/flows/:flowKey/workspace` (sin efectos: un id desconocido es 404, no se crea) | `flows.read` |
| `PUT` | `/api/builder/flows/:flowKey/draft` | `flows.write` |
| `POST` | `/api/builder/flows/:flowKey/simulate` | `runtime.execute` |

### composition/

El único lugar donde se instancian implementaciones concretas. Contiene también el seed del workspace inicial y el flow de ejemplo.

Aquí vive `composeSimulationSandbox`: arma en cada turno del laboratorio de pruebas un motor aislado —registry, sesiones en memoria, efectos de prueba y orquestador—. Instanciar infraestructura es composición, no dominio; por eso está aquí y el dominio solo conoce el puerto `SimulationSandboxFactory`.

### Estructura

`main.ts` es **sólo el entrypoint** (config → composición → listen). Cada responsabilidad vive en su archivo:

```
apps/api/
├── main.ts                    entrypoint
├── config/loadApiConfig.ts    lee y valida el entorno; falla de forma segura
├── composition/               composition root, un archivo por área
│   ├── composeAuthService.ts
│   ├── composeNodeRuntime.ts
│   ├── composeBuilderServices.ts   ← ÚNICO punto que elige la persistencia
│   └── composeSimulationSandbox.ts
├── bootstrap/createApiServer.ts    CORS → routing → errores
├── middleware/                applyCorsHeaders · authenticateRequest
├── routes/                    routeApiRequest · routeAutomationsRequest · routeBuilderApiRequest
├── handlers/                  un handler por caso de uso
└── http/                      sendJson · parseJsonBody · toErrorResponse
```

### Crecimiento

`main.ts` no debe absorber el enrutado de cada dominio nuevo. Cada área añade su router en `routes/` y `routeApiRequest` lo monta.

### Seguridad

- **CORS por allowlist.** `applyCorsHeaders` refleja el origen sólo si está en `CORS_ALLOWED_ORIGINS`. Nunca se emite `*`. En producción la variable es obligatoria.
- **Sin credenciales hardcodeadas.** La API key de desarrollo se lee de `DEV_API_KEY`. Si aparece con `NODE_ENV=production`, el proceso **no arranca**.
- **Errores 5xx no filtran el mensaje interno** (`toErrorResponse`).
- El `tenantId` sale siempre de la identidad autenticada, nunca de la URL o el body.

## apps/worker · `NO IMPLEMENTADO`

Entrypoint reservado para procesos asíncronos: reanudar sesiones `delayed` y reintentar entregas.

**Hoy no procesa nada.** No existe `infrastructure/queue`, así que un flow que alcanza un nodo `delay` queda detenido y nada lo retoma. Arrancar este proceso no habilita delays ni reintentos.

Cuando tenga contenido debe reutilizar los servicios de aplicación de los dominios, nunca reimplementar su lógica.

## domains/

Ver [`boundaries.md`](boundaries.md) para responsabilidades y [`structure.md`](structure.md) para el patrón interno.

Hay dos piezas maduras y deliberadamente separadas:

**`automations`** es el producto: catálogo, builder y validación. Los flujos no se publican: se autoguardan y lo guardado es lo que corre. Diez reglas de validación de grafo, cada una en su archivo. Ver [`automations.md`](automations.md).

**`flow-engine`** es el motor, y vive en la **raíz del proyecto**, no bajo `domains/`: orquestador, loop de ejecución, evaluador de edges, runtime de nodos con nueve handlers (`message`, `question`, `capture`, `action`, `condition`, `delay`, `fallback`, `end`, `ai`), el registry de versiones publicadas y el contrato de triggers. **No existe handler `handoff`:** esa responsabilidad es del AI Sales Engine. Ver [`flow-engine.md`](flow-engine.md).

Automations construye y guarda los flujos; el motor los ejecuta. La dependencia es unidireccional y solo por interfaces.

`sessions` aporta el estado de ejecución que el motor consume a través de puertos.

## platform/

| Capacidad | Estado | Contenido |
|---|---|---|
| `identity` | `IMPLEMENTADO` | Verificación de JWT y de API key tras una interfaz común |
| `authorization` | `IMPLEMENTADO` | Roles, scopes, policies y guards; `requireScope` protege las rutas del builder |
| `observability` | `IMPLEMENTADO` | `StructuredLogger`, `RequestLogger` y `ErrorLogger` conectados a la API |
| `observability` | `PREPARADO` | Auditoría, métricas, tracing, `AccessLogger` y `RuntimeLogger` existen sin consumidor |
| `security` | `PREPARADO` | Rate limiting con tests, sin conectar |
| `tenancy` | `IMPLEMENTADO` | Resolución por membership activa (`resolveRequestContext`), validada contra Postgres real. `TenantResolver` — límites del runtime de simulación del builder — sigue `PREPARADO` y es un concepto separado; ver [`tenancy.md`](tenancy.md) |
| `configuration` | `NO IMPLEMENTADO` | Frontera |

`usage` **no** vive en `platform/`: medir consumo alimenta límites y entitlements, así que pertenece a `domains/billing`.

## infrastructure/

`persistence/json` guarda workspaces, automatizaciones y carpetas en disco bajo `data/builder-workspaces/<tenantId>/`; es **sólo para desarrollo local**, no la persistencia definitiva. `persistence/memory` provee registries y repositorios en memoria para simulación y pruebas. `persistence/sql` es el destino de producción y está `NO IMPLEMENTADO`.

Ambos implementan puertos declarados en los dominios, lo que permite sustituirlos sin tocar lógica de negocio. Ver [`persistence.md`](persistence.md).

## Compilación

Un único proyecto TypeScript compila `apps/api`, `apps/worker`, `domains`, `platform`, `infrastructure` y `contracts` a `dist/`, preservando la estructura. El entrypoint resultante es `dist/apps/api/main.js`.

`apps/web` compila por separado con su propio `tsconfig` y Vite.

El backend usa rutas relativas, sin aliases: `tsc` no reescribe los path aliases al emitir, y usarlos rompería la ejecución de `dist/` sin herramientas adicionales.
