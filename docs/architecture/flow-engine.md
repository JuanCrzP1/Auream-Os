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
| Declarar lo que el bloque de IA necesita de un modelo | `ports/AiGateway.ts` |
| Resolver qué flow dispara un evento externo | `triggers/TriggerResolver.ts` |
| Traducir un evento externo al envelope del motor | `triggers/toInboundEnvelope.ts` |

## Qué NO hace

- **No administra automatizaciones.** Listar, crear, renombrar, organizar en carpetas o archivar es `automations`.
- **No construye flows.** Drafts, autosave y workspace del editor son `automations/builder`.
- **No valida grafos.** La validación estructural es `automations/validation`.
- **No guarda flujos.** Eso es `automations/builder`; el motor solo *lee* el flujo guardado (no hay publicación).
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
└── ports/        RuntimePorts · FlowExecutor · AiGateway · HttpRequester · ContactDirectory · RoundRobinCounter
```

Estructura plana, sin `domain/` ni `application/`. Esa separación sirve a dominios con entidades y reglas de negocio; aquí solo añadiría un nivel sin significado.

No existen carpetas `runtime/` ni `context/`: `NodeRuntime` vive en `nodes/`, que es lo que ejecuta, y el contexto de ejecución pertenece a `sessions`, consumido por el puerto `ContextWriter`. Crear esas carpetas sería decoración.

## Nodos

Un directorio por tipo, con un handler cada uno: `start`, `message`, `question`, `tags`, `payment-proof`, `condition`, `distributor`, `pixel`, `ai`, `delay`, `integration`, `menu`, `notification`, `end`.

**No existe un nodo `handoff`.** Derivar a un asesor humano es responsabilidad del AI Sales Engine; ver [`ai-sales-engine.md`](ai-sales-engine.md).

Los nombres de directorio coinciden exactamente con los valores del tipo `NodeType` en `contracts/FlowSnapshot.ts`. Esa correspondencia 1:1 es deliberada: leyendo el tipo de un nodo se sabe qué directorio lo implementa.

`NodeRuntime` recibe la lista de handlers y despacha por tipo. No existe un `switch` central ni un mega handler: añadir un tipo de nodo es añadir un directorio y registrarlo en la composición.

### Estado real de los handlers

| Handler | Estado |
|---|---|
| `start`, `end` | `IMPLEMENTADO` |
| `message`, `question` | `IMPLEMENTADO` — sus textos resuelven variables (ver «Variables en plantillas»). |
| `condition` | `IMPLEMENTADO` (C10) — `evaluateCondition`: día, hora y fecha en la zona del negocio (`RuntimeInput.timezone`), ventana de 24 h, datos y campos del contacto; «todas»/«cualquiera». Las etiquetas se leen del contacto real (Contactos). Atención, asesor y variables globales se reportan como no disponibles (regla no cumplida) hasta que existan Conversaciones. Sale por `true`/`false`. |
| `menu` | `IMPLEMENTADO` (C10) — encabezado, mensaje y pie con variables; envía el menú (texto numerado + `OutboundMessage.interactive` para botones/lista nativos) y espera; reconoce la opción por id nativo, número o texto (`matchMenuReply`) y sale por ella o por `menu-other`. |
| `distributor` | `IMPLEMENTADO` (C10) — turnos por cuenta, flujo y bloque con el puerto `RoundRobinCounter` (memoria en simulación; `SqlRoundRobinCounter` atómico en producción). |
| `delay` | `PARCIAL` — pausa el flujo (`delayed`); reanudarlo es de la cola de tareas (C6). |
| `tags` | `IMPLEMENTADO` (C10) — resuelve (o crea) el contacto que escribe por canal e identificador y le agrega o quita etiquetas a través del puerto `ContactDirectory`; al agregar, crea en el catálogo las que falten. Salida única. |
| `integration` | `IMPLEMENTADO` (C10) — petición HTTP con variables codificadas según dónde caen (URL, cabecera, JSON) vía el puerto `HttpRequester`; 2xx sale por `success` y guarda los datos mapeados en el contacto (`ContactDirectory.setFields`) y en la conversación; cualquier otra cosa sale por `failure` con el motivo. El resultado no incluye cabeceras ni cuerpo enviados (pueden llevar credenciales). |
| `ai` | `IMPLEMENTADO` (C9/C10) — `runAiStep`: instrucciones y mensaje con variables, memoria de la conversación (en la sesión, últimos N intercambios), clasificación de intención (`{intent, reply}` en JSON; una salida por intención + respaldo + error), envío opcional de la respuesta y guardado en variable. Con el puerto `AiGateway`: el motor nunca ve una clave. Archivos (audio/imagen/PDF): se declaran pendientes hasta que el canal los entregue (FASE D). |
| `payment-proof`, `pixel`, `notification` | `NO IMPLEMENTADO` — fallan explícitamente con `*_not_implemented` en lugar de simular un resultado. |

La forma de la configuración de cada bloque es un contrato compartido con el builder (`contracts/*Config.ts`, lectores en `contracts/ConfigReaders.ts`): los dos lados leen lo mismo.

`nodes/ai/AiNodeHandler.ts` es un tipo de nodo del grafo. **No es un agente** ni tiene relación con `domains/ai-agents` ni con el AI Sales Engine. Un flow con nodo de IA sigue siendo determinístico.

### Variables en plantillas

Una sola sintaxis para el builder y el motor (`contracts/TemplateVariables.ts`): `{nombre}`, con valor por defecto `{nombre|texto}` y el formato heredado `{{context.clave}}`.

- **De dónde sale el valor** (`templates/templateResolver.ts`): variables del sistema (`first_name`, `full_name`, `phone`, `email`, `last_message`) → campos personalizados del contacto → datos guardados en la conversación. Mismo orden que usa el Condicional.
- **Codificación según el destino**: texto tal cual en mensajes; componente de URL, cadena JSON escapada o cabecera sin saltos de línea en la Integración. Un dato del cliente nunca cambia la forma de la petición.
- **Mensajes** (`templates/ConversationTemplates.ts`): Mensaje, Menú y Esperar respuesta resuelven sus textos; el contacto solo se consulta si el texto usa variables.

### Peticiones salientes (Integración)

El motor declara `ports/HttpRequester.ts`; la composición inyecta `infrastructure/http/SafeHttpRequester.ts`:

- **SSRF**: solo Internet público. La IP se valida después de resolver el DNS y es la misma con la que se conecta; IP escritas en la URL, redirecciones e IPv4 dentro de IPv6 incluidas (`blockedAddresses.ts`).
- **Límites**: 10 s en total, 3 redirecciones (sin `Authorization` ni `Cookie` al cambiar de origen), cuerpo enviado ≤ 256 KB, respuesta ≤ 1 MB también tras descomprimir.
- `INTEGRATIONS_ALLOW_PRIVATE_NETWORK=true` permite la red privada **solo en desarrollo**; la API no arranca con él en producción.
- Sin red (tests): `DisabledHttpRequester`, que el bloque trata como un fallo más.

«Probar» del editor (`POST /api/builder/integrations/test`, permiso `flows.write`, 20 pruebas por minuto y cuenta) recorre el mismo código que el bloque (`runIntegrationRequest` + `mapResponseFields`) con valores de ejemplo, y devuelve las rutas de la respuesta para elegir qué guardar.

### Nodo de IA y proveedores

```
AiNodeHandler → ports/AiGateway.ts → VaultAiGateway (composición)
                                       ├── AiCredentialVault: descifra la clave de la conexión, solo en su cuenta
                                       └── infrastructure/ai: OpenAI · Gemini · OpenRouter
```

- El bloque guarda el **id de una conexión de IA** de la cuenta, nunca una clave. `stripInlineSecrets` borra la `apiKey` que guardaban las versiones anteriores, al leer y al escribir cualquier flujo.
- El motor **nunca** importa un SDK ni ve una clave: pide «genera con la conexión X» y recibe texto o un motivo de fallo (`invalid_key`, `quota_exceeded`, `rate_limited`, `model_not_found`, `content_filtered`, `timeout`…). Los mensajes de los proveedores se limpian de cualquier cosa con forma de clave.
- Clientes en `infrastructure/ai`: OpenAI y OpenRouter comparten `OpenAiCompatibleClient` (Chat Completions); Gemini usa `generateContent` con la clave en cabecera, nunca en la URL.
- «Probar» del editor (`POST /api/builder/ai/test`, `flows.write`, 10 por minuto y cuenta) recorre el mismo `runAiStep` con un mensaje de ejemplo y la conexión real.

## Edges

`EdgeEvaluator` decide qué edge se sigue, en dos modos:

- **Por salida (C14):** si el bloque declara `output`, se sigue la conexión con ese `fromOutput`. Sin conexión, la rama termina (`unconnected-output`).
- **Por condiciones:** bloques de salida única o flujos antiguos: condiciones (`always`, `eq`, `neq`, `exists`) por prioridad y fallback si ninguna se cumple; si no hay ninguno, `no-match` y la ejecución falla.

Devuelve una decisión explícita (`edge` | `unconnected-output` | `no-match`), no un nulo ambiguo. Es la única pieza que decide el recorrido del grafo. Ver [flow-connections.md](flow-connections.md).

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
