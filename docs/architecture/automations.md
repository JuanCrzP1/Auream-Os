# Automations

`domains/automations/` · `apps/web/src/features/automations/`

## Qué es

El producto principal de la plataforma: lo que permite a un usuario administrar y construir automatizaciones.

**Automations no es el motor.** Automations produce versiones publicadas; el [Flow Engine](flow-engine.md) las ejecuta. Esa separación es la decisión arquitectónica central de este dominio.

## Backend

```
domains/automations/
├── catalog/      administrar automatizaciones
├── builder/      construirlas y editarlas
├── validation/   validarlas antes de publicar
                (versionar y publicar vive en builder/)
```

### catalog

Listado, creación, borrado, renombrado, metadata y organización en carpetas.

`AutomationRepository` y `FolderRepository` son puertos; `ListAutomationsService`, `CreateFolderService` y `DeleteAutomationService` son los casos de uso. Las entidades `AutomationFlow`, `AutomationFolder`, `AutomationMetadata` y `AutomationStatus` viven en `domain/`.

**No contiene:** el contenido del grafo (eso es el snapshot), ni nada de ejecución.

### builder

Estado de edición: workspace, drafts, autosave, y las operaciones que el editor dispara — guardar, publicar, revertir, simular.

`BuilderWorkspaceRepository` es el puerto de persistencia. `GetBuilderWorkspaceService`, `SaveDraftService`, `PublishDraftService`, `RollbackDraftService` y `SimulateDraftService` son los casos de uso. `convertBuilderSnapshotToRuntime` traduce el snapshot del editor al del runtime al publicar.

`BuilderSimulationRuntime` permite probar un draft sin publicarlo. Depende del puerto `FlowExecutor`, no del orquestador concreto: el builder pide una ejecución, no sabe cómo se ejecuta.

**No contiene:** el ciclo de ejecución, los handlers de nodo ni la evaluación de edges.

### validation

Validación estructural previa a publicar. `GraphValidator` orquesta ocho reglas independientes, cada una en su archivo: ciclos, nodos inalcanzables, integridad de edges, prioridades de edges, flow vacío, nodo de entrada, fallbacks y grado de nodo.

Es validación de **definición**, no de ejecución: se responde «¿este grafo es publicable?», no «¿este mensaje avanza?».

Añadir una regla es añadir un archivo y registrarlo. No hay un validador monolítico.

### versionado y publicación

No existe un sub-módulo `versioning`. La responsabilidad vive en `builder/`:

| Pieza | Responsabilidad |
|---|---|
| `PublishDraftService` | Valida el grafo y promueve el draft a versión publicada |
| `RollbackDraftService` | Revierte a una versión anterior |
| `createVersionedBuilderSnapshot` | Crea el snapshot inmutable versionado |

Existió un `VersioningService` con la misma responsabilidad que `PublishDraftService` (validar → publicar) y sin ningún consumidor. Se eliminó por duplicado: mantener dos servicios para publicar era exactamente el tipo de ambigüedad que esta arquitectura evita.

Las sesiones activas quedan ancladas a la versión con la que empezaron; publicar no altera ejecuciones en curso.

### Qué NO está en Automations

`execution/`, `nodes/` y `edges/` estuvieron aquí y **se extrajeron a `flow-engine/`**. También `flow-definition/` y `builder/domain/BuilderFlow.ts`, cuyo único contenido real eran re-exports de `contracts/`; la definición del grafo es un contrato compartido, no un módulo de este dominio.

## Frontend

```
apps/web/src/features/automations/
├── list/       el hub de automatizaciones
└── builder/    el editor visual
```

Dos responsabilidades, dos módulos. La feature no tiene código suelto en su raíz.

### Contrato con el frontend

`GET /automations` devuelve `AutomationListResponse` (`contracts/AutomationContracts.ts`), **no** la entidad de dominio:

| | Dominio `AutomationFlow` | API `AutomationSummary` |
|---|---|---|
| `tenantId` | sí | **no** — lo determina el servidor |
| fechas | `metadata.updatedAt` | `updatedAt` en raíz |
| etiquetas | `metadata.tags` | `tags` en raíz |

La traducción vive en un único punto, `apps/api/http/toAutomationListResponse.ts`, y `tests/contract/automationApiContract.test.ts` la protege.

Existió una copia del tipo en `apps/web/.../list/types/automation.ts` que declaraba `updatedAt` en raíz mientras la API enviaba `metadata.updatedAt`: la tarjeta del hub renderizaba «Invalid Date» y ningún test lo detectaba, porque los fixtures del frontend codificaban la forma equivocada. Por eso el contrato es único.

### list

El hub: listado, búsqueda, carpetas, tarjetas, menú contextual y los modales de renombrar y borrar.

`pages/AutomationsHubPage.tsx` compone; `hooks/` gestionan carga y acciones; `services/` hablan con la API; `components/` son las piezas visuales.

### builder

```
builder/
├── pages/                  BuilderPage
├── components/
│   ├── canvas/             lienzo, tarjetas de nodo, tipos de nodo, barra de ayuda
│   ├── panels/             paleta, inspectores, validación, simulación, release
│   ├── editor/             modal de edición de nodo
│   └── builder-shell/      layout propio del editor
├── hooks/
│   ├── builder/            carga, autosave, publicación, simulación
│   └── canvas/             nodos, edges, selección
├── services/               llamadas a la API del builder y utilidades puras
├── adapters/               canvas ↔ snapshot
└── types/                  tipos del canvas
```

El canvas está aislado: `BuilderCanvas` renderiza, y el estado del editor vive en hooks separados por responsabilidad — `useCanvasNodes`, `useCanvasEdges`, `useCanvasSelection`. No hay un componente que controle todo el builder.

`components/panels/` se llamaba `sidebar/`; el nombre chocaba con el sidebar de navegación de la aplicación, que es otra cosa.

#### Paneles construidos pero aún no montados · `PREPARADO`

`BuilderPage` monta hoy la paleta, el canvas, la topbar y el modal de edición. Estos cinco componentes existen, compilan y están completos, pero **ninguna pantalla los renderiza todavía**:

| Componente | Qué mostrará |
|---|---|
| `panels/NodeInspector` | Edición del nodo seleccionado |
| `panels/EdgeInspector` | Edición del edge seleccionado |
| `panels/ValidationPanel` | Informe de `validateCanvasGraph` |
| `panels/SimulationPanel` | Conversación simulada del draft |
| `panels/ReleasePanel` | Publicación, rollback y versión activa |
| `canvas/CanvasHintBar` | Ayuda contextual del lienzo |

`useBuilderWorkspace` ya produce todo lo que necesitan —`selectedNode`, `selectedEdge`, `validation`, `stats`, `simulationLog`, `handlePublish`, `handleRollback`, `handleSimulate`—, así que montarlos es trabajo de UI, no de arquitectura.

**No son código muerto ni se conectan artificialmente para que "parezcan usados".** Quedan marcados `PREPARADO` hasta que exista la decisión de diseño de dónde colocarlos.

Ningún archivo de la feature supera las 190 líneas. No se fragmentó más: dividir componentes de 80 líneas en carpetas de un archivo sería peor, no mejor.

## Frontera con el Flow Engine

```
Automations                        Flow Engine
─────────────                      ───────────
catalog     administra
builder     construye ──simula──>  FlowExecutor
validation  valida
builder  publica ──registra──>  FlowRegistry ──ejecuta──> execution
```

Automations depende del motor **solo por interfaces**, siempre con `import type`. Ninguna clase concreta del motor cruza esta frontera.

La dirección inversa no existe: el motor no conoce Automations. Ejecuta una versión publicada sin saber quién la construyó.

## Reglas

**Permitido:** `automations` → `contracts/` · `automations` → `platform/` · `automations` → interfaces de `flow-engine` (`import type`).

**Prohibido:** `automations` → `infrastructure/` concreta · `automations` → clases concretas de `flow-engine` · `automations` → otro dominio de negocio · lógica de ejecución dentro de `automations`.

## Estado

`IMPLEMENTADO` de punta a punta: listar, crear, renombrar y borrar automatizaciones; editar en el canvas con autosave; validar; publicar; revertir; y simular un draft.

Es el único dominio de negocio completo de la plataforma.
