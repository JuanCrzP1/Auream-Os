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
