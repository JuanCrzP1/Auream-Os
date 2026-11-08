# Persistencia

## Regla arquitectónica

**La persistencia es relacional, basada en SQL, y los dominios dependen de contratos —nunca de una implementación concreta.**

La arquitectura no está acoplada a ningún proveedor. Un motor SQL concreto, un servicio gestionado o un esquema de despliegue son decisiones de infraestructura, revisables sin tocar una línea de lógica de negocio. Ningún contrato ni servicio de dominio debe nombrar un proveedor.

**Destino elegido: SQL desplegado en Neon.** Esa decisión vive aquí y en `apps/api/composition/composeBuilderServices.ts`, en ningún otro sitio. Migrar consiste en escribir los adaptadores de `persistence/sql/` y cambiar esa composición: **ningún archivo de `domains/` debe modificarse**.

Este documento describe la frontera y el estado actual.

## Estructura

```
domains/<x>/application/     declara el PUERTO (interfaz de repositorio)
        ↓ implementado por
infrastructure/persistence/  json · memory · sql (frontera preparada)
        ↓ inyectado desde
apps/api/composition/        elige la implementación según el entorno
```

Un servicio de dominio recibe un puerto. Nunca construye su repositorio ni sabe cómo se almacena el dato.

## Implementaciones actuales

### `persistence/json` · `IMPLEMENTADO`

Persiste en disco bajo `data/builder-workspaces/<tenantId>/`. Cubre workspaces del builder, automatizaciones y carpetas.

Es la persistencia de **desarrollo local únicamente**. El aislamiento por tenant es físico: un directorio por tenant.

**No es la persistencia definitiva de la SaaS** y no debe ampliarse: sin transacciones, sin queries, sin índices y con escrituras concurrentes no seguras, no sostiene miles de tenants. Se retirará cuando `sql/` esté operativo.

### `persistence/memory` · `IMPLEMENTADO`

Registries y repositorios en memoria: sesiones, registro de flows, credenciales de API, eventos de auditoría y suscripciones.

Se usa en pruebas y en el runtime de simulación del builder, donde cada simulación necesita un stack aislado y efímero. No sobrevive al reinicio, y no pretende hacerlo.

### `persistence/sql` · `IMPLEMENTADO`

`SqlClient` es el único punto que conoce el driver `pg`.

- **Tenancy:** `SqlTenantRepository`, `SqlMembershipRepository`, `SqlOnboardingRepository`.
- **Automatizaciones (FASE C1/C2):** `SqlAutomationRepository` (catálogo), `SqlFolderRepository` (carpetas) y `SqlBuilderWorkspaceRepository` (borrador). Implementan los mismos puertos que los de `json/`: ningún caso de uso cambió.

**Modelo de automatizaciones** (`004_automations.sql`):

| Tabla | Contenido |
|---|---|
| `automation_folders` | Carpetas, por tenant. |
| `automations` | El catálogo: nombre, estado, carpeta, etiquetas. `(tenant_id, key)` único. |
| `automation_drafts` | **Un documento por flujo** (`snapshot jsonb`) y `revision` para el bloqueo optimista. Cuelga de `automations (tenant_id, key)` en cascada: borrar la automatización borra su borrador. |

Decisión: el flujo es un documento, no filas de bloques y conexiones. El editor lo lee y escribe siempre entero y su forma la define (y migra) el contrato `BuilderFlowSnapshot`.

Reglas de los repositorios: toda consulta filtra por `tenant_id`; un `save` no puede sobrescribir una fila de otro tenant (`on conflict … where tenant_id = …`); un id que no es uuid se trata como inexistente en lugar de provocar un error de base de datos.

**Transacciones (C3):** las operaciones que escriben en varias tablas (crear, duplicar, guardar borrador + nombre, borrar) se hacen dentro de `AutomationsUnitOfWork.run` (puerto en `domains/automations/builder/application`). En SQL, `SqlAutomationsUnitOfWork` abre una transacción real y entrega repositorios ligados a ella: si algo falla, rollback de todo. Con archivos, `DirectUnitOfWork` ejecuta sin garantía (solo desarrollo).

**Bloqueo optimista (C4):** cada guardado del builder envía `baseRevision`. `SaveDraftService` rechaza con `ConflictError` (409) si ya no es la actual, y `SqlBuilderWorkspaceRepository.saveWorkspace(…, { expectedRevision })` hace la comprobación y la escritura en una sola sentencia (`on conflict … where revision = $n`): dos escrituras simultáneas no pueden pasar las dos. El builder, ante un 409, deja de guardar y ofrece recargar.

**Selección del almacén:** `AUTOMATIONS_STORE` (`sql` | `json`), resuelta en `apps/api/composition/composeBuilderServices.ts`. En producción solo se acepta `sql`: la API no arranca con `json`.

**Importar los datos de archivos:** `apps/api/scripts/importJsonAutomations.ts` reutiliza los repositorios de ambos lados y `upgradeWorkspace`, escribe cada flujo en una transacción y es idempotente. Por defecto simula; `--apply` escribe.

```
npm run db:import-automations:test -- --apply     rama test
npm run db:import-automations:prod -- --apply     producción (exige DATABASE_URL de producción)
```

#### Migraciones

`infrastructure/persistence/sql/migrations/` con control en `schema_migrations`
(nombre, checksum, fecha). El runner es `scripts/db/migrate.mjs`:

```
npm run db:migrate:test     rama test (por defecto, sin flags)
npm run db:migrate:prod     producción — exige --confirm-production
```

Una migración modificada después de aplicarse produce checksum mismatch y aborta:
nunca se reaplica ni se ignora en silencio.

El flujo obligatorio es `test → tests de integración → revisión → producción`.
Producción nunca se migra desde la suite de tests.

#### Entornos de Neon

| Entorno | Rama | Dónde vive su credencial |
|---|---|---|
| Desarrollo local | **test** (`ep-rapid-lake…`), base y login | `.env` (`DATABASE_URL`) y `.env.test` (`TEST_DATABASE_URL`), ambos fuera de git |
| Tests de integración | **test** | `.env.test` |
| Producción | **producción** (`ep-lingering-shape…`) | Solo en el entorno de despliegue. Nunca en un equipo de desarrollo |

Las migraciones y la importación de automatizaciones se aplican primero en test (con sus tests de integración) y en producción al desplegar, con `--confirm-production` y verificación del host.

#### Aislamiento de entornos

`scripts/db/resolveTargetDatabase.mjs` es la ÚNICA pieza que decide el destino.
Migraciones, seed y el setup de los tests de integración la comparten. La
comprobación es por HOST real, así que una variable mal configurada que apunte a
producción se detecta igual.

## Migración a SQL

La migración no toca `domain/` ni `application/`:

1. Implementar los puertos existentes en `infrastructure/persistence/sql`.
2. Añadir el cliente de conexión y las migraciones de esquema.
3. Cambiar la implementación inyectada en `apps/api/composition/`, por entorno.

`persistence/json` y `persistence/memory` no desaparecen: siguen sirviendo a desarrollo local y a pruebas.

### Traducción del aislamiento

El directorio por tenant se convierte en una columna `tenant_id` obligatoria e indexada en cada tabla. Toda consulta la filtra. Como el puerto ya exige `tenantId` en la firma, ninguna consulta puede omitirlo por descuido.

Si en algún momento la escala exige esquemas separados o particionado, esa decisión se toma dentro de `infrastructure/persistence/sql` y no cambia ningún dominio.

### Modelo ya preparado

Las entidades de runtime están diseñadas para migración directa: `Session` incluye `channel`, `conversationKey`, `userKey`, `createdAt` y `updatedAt` de forma explícita para no requerir JOINs, y `revision` funciona como bloqueo optimista. El versionado de flows se basa en snapshots inmutables, que se traducen a filas append-only.

## Prohibiciones

- SQL en `domain/` o en `application/`. Toda consulta vive detrás de un puerto, implementada en `infrastructure/`.
- Nombres de proveedor en contratos, dominios o documentación de arquitectura.
- Un dominio importando un repositorio concreto.
- Un puerto de repositorio sin `tenantId`.

## Datos locales

`data/` contiene datos de runtime escritos por la aplicación. No es código fuente y está fuera del control de versiones. Los fixtures de prueba viven en `tests/fixtures/` y no deben mezclarse con datos de runtime.
