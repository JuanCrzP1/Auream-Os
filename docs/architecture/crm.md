# CRM

**CRM** (`/crm`): el embudo de ventas (tablero o lista), los contactos con sus etiquetas y los seguimientos. Dominios [`domains/crm`](../../domains/crm/README.md) y [`domains/contacts`](../../domains/contacts) · web [`features/crm`](../../apps/web/src/features/crm/README.md).

## La idea central: cada etapa ES una etiqueta

Estar en «Pidió precio» es tener la etiqueta «Pidió precio». Así, el bloque **Etiquetas** de los flujos, el chat y la ficha del contacto mueven clientes de etapa sin un camino aparte. Por eso no hay un bloque nuevo y siguen siendo 13 herramientas. Es el modelo de FunnelChat (columnas ligadas a etiquetas).

**Una sola etapa por embudo.** Contactos tiene un único paso por donde cambian las etiquetas (`LabelRulesContactRepository`):

1. Al poner una etiqueta de un **grupo excluyente**, quita las demás del mismo grupo.
2. Si llegan dos del mismo grupo a la vez, gana la nueva (la que aún no tenía).
3. Avisa lo que de verdad cambió, y quién lo hizo: un flujo, una persona, una venta o una regla.

El CRM le dice a Contactos cuáles son los grupos (las etapas de cada embudo) por el puerto `ExclusiveLabelGroups`, con una sola consulta. Contactos no conoce al CRM.

Si dos cambios simultáneos dejaran a alguien con dos etapas, el tablero lo cuenta en la más avanzada: nunca aparece dos veces.

## Qué guarda cada cosa

| Tabla (`032_crm.sql`) | Qué |
|---|---|
| `crm_pipelines` | El embudo y sus ajustes: etapa de entrada, etapa de compra, producto del valor por defecto y reparto por turnos |
| `crm_stages` | Cada etapa: su etiqueta (`label_id`, única por cuenta), qué quiere decir (`open` aún no compra · `won` ya compró · `lost` no compró) y su orden. Nombre y color son los de la etiqueta |
| `crm_deals` | Lo que la etiqueta no dice: valor y moneda, producto, responsable, desde cuándo está en la etapa, cuándo entró y cuándo compró (`won_at`) |
| `crm_events` | El historial: cambió de etapa, salió del embudo, responsable, valor, con quién o qué lo hizo (flujo, persona, venta, solo) |
| `crm_follow_ups` | Seguimientos: qué hacer, cuándo, quién, y si ya se hizo |

Quitar una etapa o un embudo **no borra la etiqueta ni a nadie**: solo deja de ser etapa. Si se borra la etiqueta, la etapa se va con ella.

## Lo que pasa solo (`StageTracker`)

| Cuándo | Qué hace |
|---|---|
| Le ponen la etiqueta de una etapa | Anota la etapa y desde cuándo, y el historial. Si es nuevo en el embudo, le pone el **precio del producto en su país** (por su número) y un **responsable por turnos** (si el embudo lo pide; nunca alguien de solo lectura) |
| Le quitan la etiqueta | Sale del embudo (queda en el historial) |
| Llega un contacto nuevo | Entra a la etapa de entrada de cada embudo (`contactCreated`) |
| Escribe un cliente que **ya existía** y no está en el embudo | También entra a la etapa de entrada (`contactWrote`). Corre **antes** del flujo, así no pisa la etapa que el flujo ponga. Quien ya está en el embudo, en cualquier etapa, no se mueve |
| Se aprueba una venta suya (bloque Registrar venta o Ventas) | Pasa a la etapa de compra con el **valor real**. Si ya va más adelante («Entregado»), no se devuelve |

**Quiénes entran solos** (`crm_pipelines.entry_source`, `041_crm_entry_source.sql`) se elige al configurar el embudo:
- **todos los que escriben** (por defecto);
- **solo los que llegaron por un anuncio** (el contacto tiene origen de anuncio);
- o **nadie**, cuando el embudo no tiene etapa de entrada.

**Traer clientes existentes** (`ClientImport`, `SqlCrmImportCandidates`): los contactos con chat en los últimos 7, 30 o 90 días (o todos) que aún no tienen ninguna etapa del embudo entran a la etapa de entrada. Antes de traerlos se ve cuántos son. Se trae en tandas de 500 (`MAX_IMPORT_PER_RUN`). Se ofrece solo al crear un embudo, y luego queda en el botón «Traer clientes».

Nunca lanza: un fallo del CRM no rompe un flujo, el chat ni una venta (`crm.event_failed` en el registro). Contactos y Ventas avisan por sus puertos (`ContactEvents`, `SaleEvents`). Como el CRM usa los servicios de Contactos, se compone después, y los avisos le llegan por `CrmEventsRelay`.

## Arquitectura

```
Contactos ──LabelRulesContactRepository──puerto ExclusiveLabelGroups──> StageLabelRules (crm)
          └──puerto ContactEvents──┐
Ventas ────puerto SaleEvents───────┴──> CrmEventsRelay ──> StageTracker (crm)
API /crm ──> PipelineServices · BoardServices · DealServices · FollowUpServices (domains/crm)
CRM ──puertos ContactLabeler · StageLabels · CrmProductCatalog · CrmTeamDirectory · TurnCounter──> otros módulos
```

- El dominio `crm` no importa otros dominios: todo por `CrmGateways.ts` y `CrmRepositories.ts`.
- La composición (`apps/api/composition/composeCrmServices.ts`) decide quién cumple cada puerto.
- El tablero (`SqlCrmBoard`) sale de las etiquetas, con el valor y el responsable de `crm_deals`, el próximo seguimiento y el último mensaje.

## Los números del embudo

- **Avanza** (entre etapas): de los que llegaron a una etapa, cuántos llegaron a la siguiente. Se cuenta de forma acumulada, lo estándar: quien está en «Pagó» ya pasó por «Interesado». Las etapas de «no compró» no van en la cinta.
- **Por cerrar**: lo que suman los que aún no compran, **por moneda** (nunca se mezclan).
- **Vendido · 30 días**: quienes pasaron a una etapa de compra en los últimos 30 días.
- **De cada 100, compran**: de todos los del embudo (incluidos los perdidos), cuántos compraron.
- **Tardan en comprar**: días promedio desde que entran hasta que compran (últimos 90 días).

## Permisos

| | Dueño | Administrador | Asesor | Solo lectura |
|---|---|---|---|---|
| Ver embudo, ficha y seguimientos (`crm.read`) | ✓ | ✓ | ✓ | ✓ |
| Mover clientes, valor, responsable y seguimientos (`crm.write`) | ✓ | ✓ | ✓ | — |
| Crear, configurar y quitar embudos (`crm.manage`) | ✓ | ✓ | — | — |

## API

| Ruta | Permiso | Para qué |
|---|---|---|
| `GET /crm/pipelines` | `crm.read` | Embudos, quién puede ser responsable y qué puede quien pregunta |
| `POST /crm/pipelines` · `POST /crm/pipelines/starter` | `crm.manage` | Crear uno, o el de ejemplo (Nuevo → Interesado → Pidió precio → Pagó → Entregado, y Perdido) |
| `PATCH` · `DELETE /crm/pipelines/:id` | `crm.manage` | Configurar (reemplaza la lista de etapas) · quitar |
| `GET` · `POST /crm/pipelines/:id/import` | `crm.manage` | Cuántos clientes existentes entrarían (`?days`) · traerlos (`{ days }`, `null`: todos) |
| `GET /crm/pipelines/:id/board?owner&search` | `crm.read` | Columnas (25 por etapa) y números. `owner`: `me`, `none` o un miembro |
| `GET /crm/pipelines/:id/stages/:stage/cards?offset` | `crm.read` | Más de una etapa (la vista Lista) |
| `PUT /crm/pipelines/:id/deals/:contact/stage` | `crm.write` | Mover (con `reason` al pasar a «no compró») |
| `PATCH` · `DELETE /crm/pipelines/:id/deals/:contact` | `crm.write` | Valor, producto y responsable · sacar del embudo |
| `GET /crm/contacts/:id` | `crm.read` | La ficha: etapa en cada embudo, seguimientos e historial |
| `GET /crm/follow-ups?bucket&assignee=all` | `crm.read` | Vencidos · Hoy · Próximos · Hechos, según el día de la empresa |
| `POST` · `PATCH` · `DELETE /crm/follow-ups[/:id]` | `crm.write` | Crear, cambiar o marcar hecho, quitar |

## La pantalla

- **Embudo**, con el tablero estándar:
  - Arriba, los cuatro números dichos en palabras.
  - Debajo, la **cinta del embudo**: se angosta según cuántos llegan y muestra el % que avanza en cada frontera, alineada con sus columnas.
  - Una columna por etapa, con su número y lo que suma. Las tarjetas se **arrastran**, o se mueven con «Mover a…» (teclado y celular).
  - La vista **Lista** muestra todos los clientes de una etapa en una tabla. Hay filtros por responsable («Mis clientes», «Sin responsable») y búsqueda.
  - Pasar a «no compró» pregunta por qué.
- **Ficha** del cliente:
  - la barra de etapas, con «Mover a Pagó →» y «No compró»;
  - el valor (precio del producto en su país o un monto a mano) y el responsable;
  - los seguimientos con atajos («Mañana 9:00 a. m.»), sus etiquetas, el historial y «Abrir chat».
- **Contactos**: la lista y el catálogo de etiquetas de siempre.
- **Seguimientos**: los míos o de todo el equipo, con la insignia de vencidos.

## Pruebas

**Backend:**
- `tests/unit/labelRulesContactRepository.test.ts`
- `crmPipelines.test.ts`
- `crmStageTracker.test.ts`
- `crmFollowUps.test.ts`
- `tests/security/routeCrm.test.ts`
- `tests/integration/crmPersistence.test.ts` (PostgreSQL real, armado como en producción)

**Web:** `CrmPage.test.tsx` y `CrmDealDrawer.test.tsx`.

## Después

- Avisos de seguimientos por WhatsApp o notificación cuando lleguen. Hoy se ven en la app, con la insignia de vencidos.
- **Varios negocios por cliente (recompras)**: hoy hay un registro por cliente y embudo, así que una segunda compra no queda como negocio aparte.
- Difusiones por etapa (D5).
- El Dashboard (G1) con los números del embudo por asesor.
