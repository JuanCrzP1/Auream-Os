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

### `persistence/sql` · `IMPLEMENTADO` (tenancy) · `NO IMPLEMENTADO` (automations)

Implementado para tenancy: `SqlClient` (único punto que conoce el driver `pg`),
`SqlTenantRepository`, `SqlMembershipRepository` y `SqlOnboardingRepository`.

Los repositorios de automations siguen en `json/`: migrarlos es trabajo posterior
y no requiere cambiar ningún contrato, porque sus puertos ya existen.

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
