# Flow Engine

`flow-engine/`

## Qué es

El motor de ejecución de flujos conversacionales. Recibe un mensaje entrante y una versión publicada de un flow, y avanza la ejecución: resuelve el nodo actual, lo ejecuta, evalúa las condiciones de salida, elige el siguiente y actualiza el estado.

Es un motor técnico, no un dominio de negocio. No tiene entidades con reglas comerciales: tiene un ciclo de ejecución.

## Qué hace

| Responsabilidad | Ubicación |
|---|---|
| Orquestar un mensaje entrante de principio a fin | `execution/ExecutionOrchestrator.ts` |
| Ejecutar el ciclo nodo → resultado → siguiente nodo | `execution/ExecutionLoop.ts` |
| Emitir eventos operativos de la ejecución | `execution/ExecutionEventTracker.ts` |
| Evaluar condiciones de edge y elegir la salida | `edges/EdgeEvaluator.ts` |
| Despachar la ejecución al handler del tipo de nodo | `nodes/NodeRuntime.ts` |
| Ejecutar un tipo de nodo concreto | `nodes/<tipo>/<Tipo>NodeHandler.ts` |
| Resolver la versión publicada que debe ejecutarse | `registry/FlowRegistry.ts` |
| Declarar lo que el motor necesita del exterior | `ports/RuntimePorts.ts` |
| Declarar lo que el motor ofrece al exterior | `ports/FlowExecutor.ts` |
| Declarar el proveedor que ejecutará el nodo de IA | `ports/AiProvider.ts` |
| Resolver qué flow dispara un evento externo | `triggers/TriggerResolver.ts` |
| Traducir un evento externo al envelope del motor | `triggers/toInboundEnvelope.ts` |

## Qué NO hace

- **No administra automatizaciones.** Listar, crear, renombrar, organizar en carpetas o archivar es `automations`.
- **No construye flows.** Drafts, autosave y workspace del editor son `automations/builder`.
- **No valida grafos.** La validación estructural previa a publicar es `automations/validation`.
- **No versiona ni publica.** Eso es `automations/builder` (`PublishDraftService`); el motor solo *lee* lo publicado.
- **No deriva a un asesor humano.** El handoff pertenece **exclusivamente** al AI Sales Engine. El motor no tiene nodo `handoff` ni estado `handed_off`.
- **No posee el estado de sesión.** Lo consume por puerto; el dueño es `sessions`.
- **No conoce el frontend.** Ni React, ni canvas, ni componentes visuales.
- **No conoce la infraestructura.** Ni ficheros, ni SQL, ni proveedores concretos.
- **No tiene nada que ver con el AI Sales Engine.** Son dos motores independientes.

## Estructura

```
flow-engine/
├── execution/    ExecutionOrchestrator · ExecutionLoop · ExecutionEventTracker
├── edges/        EdgeEvaluator
├── nodes/        NodeRuntime · NodeHandler + un directorio por tipo de nodo
├── registry/     FlowRegistry · ActiveFlowVersion
├── triggers/     TriggerResolver · toInboundEnvelope
└── ports/        RuntimePorts · FlowExecutor · AiProvider
```

Estructura plana, sin `domain/` ni `application/`. Esa separación sirve a dominios con entidades y reglas de negocio; aquí solo añadiría un nivel sin significado.

No existen carpetas `runtime/` ni `context/`: `NodeRuntime` vive en `nodes/`, que es lo que ejecuta, y el contexto de ejecución pertenece a `sessions`, consumido por el puerto `ContextWriter`. Crear esas carpetas sería decoración.

## Nodos

Un directorio por tipo, con un handler cada uno: `message`, `question`, `capture`, `action`, `condition`, `delay`, `fallback`, `end`, `ai`.

**No existe un nodo `handoff`.** Derivar a un asesor humano es responsabilidad del AI Sales Engine; ver [`ai-sales-engine.md`](ai-sales-engine.md).

Los nombres de directorio coinciden exactamente con los valores del tipo `NodeType` en `contracts/FlowSnapshot.ts`. Esa correspondencia 1:1 es deliberada: leyendo el tipo de un nodo se sabe qué directorio lo implementa.

`NodeRuntime` recibe la lista de handlers y despacha por tipo. No existe un `switch` central ni un mega handler: añadir un tipo de nodo es añadir un directorio y registrarlo en la composición.

### Estado real de los handlers

| Handler | Estado |
|---|---|
| `message`, `question`, `capture`, `condition`, `delay`, `fallback`, `end` | `IMPLEMENTADO` |
| `action` | `NO IMPLEMENTADO` — no existe ejecutor de efectos externos. Falla explícitamente con `action_node_not_implemented` en lugar de simular un resultado. |
| `ai` | `NO IMPLEMENTADO` — no existe implementación de `ports/AiProvider.ts`. Falla explícitamente con `ai_provider_not_implemented`. |

`nodes/ai/AiNodeHandler.ts` es un tipo de nodo del grafo. **No es un agente** ni tiene relación con `domains/ai-agents` ni con el AI Sales Engine. Un flow con nodo de IA sigue siendo determinístico.

### Nodo de IA y proveedores

```
AI Node → ports/AiProvider.ts → infrastructure/providers/ai/{openai,gemini}
```

El motor **nunca** importa un SDK de proveedor. El puerto declara credencial, modelo, prompt y el contexto autorizado.

**Bloqueo conocido:** `NodeHandler.execute` es síncrono y `AiProvider.complete` es asíncrono. Conectarlos exige convertir en asíncrona la cadena `NodeHandler → NodeRuntime → ExecutionLoop → ExecutionOrchestrator`. Decisión pendiente.

## Edges

`EdgeEvaluator` decide qué edge se sigue: evalúa las condiciones (`always`, `eq`, `neq`, `exists`) por prioridad y aplica el fallback cuando ninguna se cumple. Es la única pieza que decide el recorrido del grafo.

## Contexto y estado

El motor no almacena estado. Lo declara como puertos en `ports/RuntimePorts.ts`:

| Puerto | Qué necesita el motor |
|---|---|
| `SessionStore` | Obtener o crear la sesión activa y transicionarla de nodo o de estado |
| `ContextWriter` | Aplicar parches al contexto acumulado de la sesión |
| `TenantContextResolver` | Resolver el contexto y los límites del tenant |
| `AnalyticsSink` | Emitir eventos operativos |

No existe un puerto de conversaciones: el inbox operacional pertenece al futuro dominio `conversations` y el motor identifica el canal por `InboundEnvelope.conversationKey`.

`sessions` y `analytics` los satisfacen estructuralmente. El motor nunca los importa.

## Relación con Sessions

El motor decide **qué nodo sigue**; `sessions` guarda **dónde está** cada conversación y qué contexto acumuló.

El motor consume `SessionStore` y `ContextWriter`, nunca el dominio. `Session` y `SessionStatus` son tipos de `contracts/RuntimeContracts` porque cruzan esa frontera. La entidad `Conversation` **no** vive ahí: pertenece al futuro dominio `conversations`.

El motor no absorbe `sessions`: si lo hiciera, el estado conversacional quedaría atrapado dentro del runtime y el inbox no podría leerlo.

## Relación con Automations

```
automations/builder  ──publica──>  FlowRegistry  ──lee──>  flow-engine/execution
automations/builder  ──simula───>  FlowExecutor
```

`automations` produce versiones publicadas; el motor las ejecuta. El acoplamiento es unidireccional y solo por interfaces:

- `FlowRegistry` — `builder` publica un snapshot, el motor lo resuelve para ejecutar.
- `FlowExecutor` — `builder` simula un draft sin conocer el orquestador concreto.

Ambos son `import type`. Ninguna clase concreta del motor cruza hacia `automations`.

Detalle del lado del producto en [`automations.md`](automations.md).

## Reglas de dependencia

**Permitido:** `flow-engine` → `contracts/` · `flow-engine` → sus propios puertos · `automations` → interfaces de `flow-engine` (`import type`) · la composición en `apps/api` inyecta implementaciones concretas.

**Prohibido:** `flow-engine` → `domains/automations` · `flow-engine` → `domains/sessions` u otro dominio · `flow-engine` → `infrastructure/` · `flow-engine` → frontend, React o canvas · `flow-engine` → proveedor concreto · `automations` → clases concretas del motor.

Verificación:

```bash
grep -rn "automations/"     flow-engine --include=*.ts | wc -l   # 0
grep -rn "infrastructure/"  flow-engine --include=*.ts | wc -l   # 0
grep -rn "sessions/"        flow-engine --include=*.ts | wc -l   # 0
grep -rn "flow-engine/" domains/automations --include=*.ts | grep -v "import type"  # vacío
```

## Composición

El motor no se ensambla a sí mismo. `apps/api/composition/` construye el `NodeRuntime` con sus handlers y, para la simulación del builder, un stack aislado por tenant mediante `BuilderSimulationRuntimeFactory`.

Instanciar implementaciones concretas es composición, no motor.

## Triggers

El contrato que convierte un hecho externo en una ejecución:

```
EVENTO EXTERNO → TRIGGER → FLOW PUBLICADO → FLOW ENGINE → EJECUCIÓN
```

| Pieza | Ubicación | Estado |
|---|---|---|
| `ExternalEvent`, `TriggerBinding`, `TriggerType` | `contracts/TriggerContracts.ts` | `PREPARADO` |
| `TriggerResolver` — evento → binding | `flow-engine/triggers/TriggerResolver.ts` | `PREPARADO` (puerto, sin implementación) |
| `toInboundEnvelope` — evento → envelope | `flow-engine/triggers/toInboundEnvelope.ts` | `IMPLEMENTADO` y con test |

Los contratos son **agnósticos del canal**: no mencionan WhatsApp, Meta ni QR. Connections traducirá cada canal a un `ExternalEvent`.

`toInboundEnvelope` rechaza un binding de otro tenant: es la primera barrera de aislamiento del disparo.

**NO IMPLEMENTADO:** no existe emisor de eventos, ni almacén de bindings, ni endpoint HTTP que reciba un evento externo.

## Estado

| Capacidad | Estado |
|---|---|
| Recorrer el grafo, ejecutar nodos, evaluar edges | `IMPLEMENTADO` |
| Ejecutarse desde la simulación del builder | `IMPLEMENTADO` — `/api/builder/flows/:flowKey/simulate` |
| Contrato de trigger | `PREPARADO` |
| Ejecutarse desde un evento externo real | `NO IMPLEMENTADO` — no hay entrypoint de eventos |
| Nodo `action` y nodo `ai` | `NO IMPLEMENTADO` |
| Reanudar sesiones `delayed` | `NO IMPLEMENTADO` — no hay cola; ver `apps/worker` |
| Reintentos | `NO IMPLEMENTADO` |

**Importante:** hoy el motor sólo se ejecuta en simulación. Un flow publicado no se dispara solo, porque no existe todavía nada que emita eventos.

Cuando `apps/worker` lo use, debe consumir el motor por sus contratos y no reimplementar ninguna parte del ciclo.
