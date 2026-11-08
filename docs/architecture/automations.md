# Automations

`domains/automations/` · `apps/web/src/features/automations/`

## Qué es

El producto principal de la plataforma: lo que permite a un usuario administrar y construir automatizaciones.

**Automations no es el motor.** Automations construye y guarda los flujos; el [Flow Engine](flow-engine.md) los ejecuta. Esa separación es la decisión arquitectónica central de este dominio.

## Backend

```
domains/automations/
├── catalog/      administrar automatizaciones
├── builder/      construirlas y editarlas
├── validation/   ¿el grafo puede ejecutarse?
```

### catalog

Listado, creación, borrado, renombrado, metadata y organización en carpetas.

`AutomationRepository` y `FolderRepository` son puertos; `ListAutomationsService`, `CreateFolderService` y `DeleteAutomationService` son los casos de uso. Las entidades `AutomationFlow`, `AutomationFolder`, `AutomationMetadata` y `AutomationStatus` viven en `domain/`.

**No contiene:** el contenido del grafo (eso es el snapshot), ni nada de ejecución.

### builder

Estado de edición: workspace, borrador, autoguardado y simulación.

`BuilderWorkspaceRepository` es el puerto de persistencia; la composición lo envuelve en `UpgradingBuilderWorkspaceRepository`, que migra al formato vigente todo lo que se lee. `GetBuilderWorkspaceService`, `SaveDraftService` y `SimulateDraftService` son los casos de uso. `convertBuilderSnapshotToRuntime` traduce el snapshot del editor al del runtime.

`BuilderSimulationRuntime` permite probar un borrador sin clientes reales. Depende del puerto `FlowExecutor`, no del orquestador concreto: el builder pide una ejecución, no sabe cómo se ejecuta.

**No contiene:** el ciclo de ejecución, los handlers de nodo ni la evaluación de edges.

### validation

Validación estructural del grafo. `GraphValidator` orquesta nueve reglas independientes, cada una en su archivo: ciclos, nodos inalcanzables, integridad de edges, prioridades de edges, flow vacío, nodo de entrada, tipos conocidos, grado de nodo y límite de salidas.

Las reglas de conexión entre bloques (una conexión por salida, inicio, ciclos a través de bloques que esperan) y dónde se aplica cada una están en [flow-connections.md](flow-connections.md).

Es validación de **definición**, no de ejecución: se responde «¿este grafo puede ejecutarse?», no «¿este mensaje avanza?». En el builder, `reviewFlow` aplica las mismas reglas (test de paridad) y añade la configuración de cada bloque; solo informa, no bloquea.

Añadir una regla es añadir un archivo y registrarlo. No hay un validador monolítico.

### Sin publicación

**Los flujos no se publican ni se versionan** (decisión de producto, 2026-11-08, como Leona): se autoguardan y lo último guardado es lo que corre. Un flujo atiende clientes cuando una conexión de WhatsApp lo tiene asignado (`TriggerBinding` conexión → flujo, FASE D).

Se retiraron `PublishDraftService`, `RollbackDraftService`, sus rutas y el historial `publishedSnapshots` (se descarta al leer). `createVersionedBuilderSnapshot` sigue normalizando el borrador al guardar.

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
│   ├── canvas/             lienzo, tarjetas de nodo y su estado, tipos de nodo
│   ├── review/             revisión del flujo
│   ├── panels/             paleta (Toolbox) y simulador (C15)
│   └── builder-shell/      layout, topbar, guardado, aviso sin conexión
├── context/                operaciones de edición y estado de revisión por bloque
├── hooks/
│   ├── builder/            carga, autoguardado, simulación
│   └── canvas/             nodos, edges, selección
├── services/               API del builder y utilidades puras (reviewFlow, reglas de conexión…)
├── tools/                  las herramientas (ver builder-tools.md)
├── adapters/               canvas ↔ snapshot
└── types/                  tipos del canvas
```
El canvas está aislado: `BuilderCanvas` renderiza, y el estado del editor vive en hooks separados por responsabilidad — `useCanvasNodes`, `useCanvasEdges`, `useCanvasSelection`. No hay un componente que controle todo el builder.

`components/panels/` se llamaba `sidebar/`; el nombre chocaba con el sidebar de navegación de la aplicación, que es otra cosa.

#### Superficies del builder

| Superficie | Dónde | Qué hace |
|---|---|---|
| Topbar | Arriba a la izquierda | Volver, nombre editable y estado del autoguardado (`SaveStatusPill`). Sin publicar, versión ni rollback |
| Toolbox (`PalettePanel`) | Flotando sobre el lienzo | Las 12 herramientas |
| Revisión del flujo (`review/FlowReviewPanel`) | Arriba a la derecha del lienzo | Lista lo que está mal o incompleto (`services/reviewFlow.ts`) y lleva a cada bloque. Solo informa |
| Estado del bloque (`canvas/NodeStatusBadge`) | En cada nodo | Anillo y marca roja o ámbar con los motivos (`FlowReviewContext`), y «Próximamente» si el motor aún no lo ejecuta |
| Editor del bloque (`ExpandedNodeOverlay`) | Sobre el nodo | El `Editor` de cada herramienta. Los nodos de sistema (Inicio, Finalizar) no se editan |
| Aviso sin servidor (`OfflineNotice`) | Abajo al centro | Si la API no responde, el builder abre un respaldo en memoria: lo dice, no intenta guardar y ofrece «Reintentar» (recarga desde cero) |

`panels/SimulationPanel` existe pero no se monta: un simulador necesita que el motor enrute por salida y ejecute las herramientas (ROADMAP, C14 y C15).

## Frontera con el Flow Engine

```
Automations                        Flow Engine
─────────────                      ───────────
catalog     administra
builder     construye ──simula──>  FlowExecutor
validation  valida
builder  guarda ──registra──>  FlowRegistry ──ejecuta──> execution
```

Automations depende del motor **solo por interfaces**, siempre con `import type`. Ninguna clase concreta del motor cruza esta frontera.

La dirección inversa no existe: el motor no conoce Automations. Ejecuta un flujo sin saber quién lo construyó.

## Reglas

**Permitido:** `automations` → `contracts/` · `automations` → `platform/` · `automations` → interfaces de `flow-engine` (`import type`).

**Prohibido:** `automations` → `infrastructure/` concreta · `automations` → clases concretas de `flow-engine` · `automations` → otro dominio de negocio · lógica de ejecución dentro de `automations`.

## Estado

`IMPLEMENTADO` de punta a punta: listar, crear, renombrar y borrar automatizaciones; editar en el canvas con autoguardado; revisar el flujo; y simular un borrador (backend; la interfaz llega en la FASE C).

Es el único dominio de negocio completo de la plataforma.
