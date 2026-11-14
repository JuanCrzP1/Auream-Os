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
└── ports/        RuntimePorts · FlowExecutor · AiGateway · ConversionTracker · HttpRequester · MediaFetcher · DocumentTextReader · ReceiptRegistry · ContactDirectory · RoundRobinCounter
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
| `message`, `question` | `IMPLEMENTADO` — sus textos resuelven variables (ver «Variables en plantillas»). El Mensaje entrega texto, archivos (URL pública, o una variable que la trae al enviar, como `{kie.ai.result}`: si no trae un enlace, ese archivo no sale y queda `message_media_not_a_link`) y pausas, y «enviar una sola vez»; «Esperar respuesta» acepta texto o un archivo (guarda su enlace). |
| `condition` | `IMPLEMENTADO` (C10) — `evaluateCondition`: día, hora y fecha en la zona del negocio (`RuntimeInput.timezone`), ventana de 24 h, datos y campos del contacto; «todas»/«cualquiera». Las etiquetas se leen del contacto real (Contactos). Atención, asesor y variables globales se reportan como no disponibles (regla no cumplida) hasta que existan Conversaciones. Sale por `true`/`false`. |
| `menu` | `IMPLEMENTADO` (C10) — encabezado, mensaje y pie con variables; envía el menú (texto numerado + `OutboundMessage.interactive` para botones/lista nativos) y espera; reconoce la opción por id nativo, número o texto (`matchMenuReply`) y sale por ella o por `menu-other`. |
| `distributor` | `IMPLEMENTADO` (C10) — turnos por cuenta, flujo y bloque con el puerto `RoundRobinCounter` (memoria en simulación; `SqlRoundRobinCounter` atómico en producción). |
| `delay` | `REAL` — calcula cuándo seguir (espera, fecha y horario en la zona del negocio: `resolveResumeAt`), deja la sesión `delayed` y la cola de tareas la despierta a su hora (C6, [task-queue.md](task-queue.md)). |
| `tags` | `IMPLEMENTADO` (C10) — resuelve (o crea) el contacto que escribe por canal e identificador y le agrega o quita etiquetas a través del puerto `ContactDirectory`; al agregar, crea en el catálogo las que falten. Salida única. |
| `integration` | `IMPLEMENTADO` (C10) — petición HTTP con variables codificadas según dónde caen (URL, cabecera, JSON) vía el puerto `HttpRequester`; 2xx sale por `success` y guarda los datos mapeados (una ruta entra también en un JSON escrito como texto, como el `data.resultJson` de Kie.ai: `data.resultJson.resultUrls[0]`) en el contacto (`ContactDirectory.setFields`) y en la conversación; cualquier otra cosa sale por `failure` con el motivo. El resultado no incluye cabeceras ni cuerpo enviados (pueden llevar credenciales). |
| `ai` | `IMPLEMENTADO` (C9/C10) — `runAiStep`: instrucciones y mensaje con variables, memoria de la conversación (en la sesión, últimos N intercambios), clasificación de intención (`{intent, reply}` en JSON; una salida por intención + respaldo + error), envío opcional de la respuesta y guardado en variable. Con el puerto `AiGateway`: el motor nunca ve una clave. Archivos (audio/imagen/PDF): se declaran pendientes hasta que el canal los entregue (FASE D). |
| `pixel` | `IMPLEMENTADO` (C10) — `runPixelStep`: arma el evento (Lead/Compra, valor tal como se escribe en Latinoamérica: «$ 49.900», «1.234,50»; atribución al anuncio de clic a WhatsApp si el contacto trae `ctwa_clid` y el bloque la página: `LeadSubmitted`/`business_messaging`) y lo envía por el puerto `ConversionTracker`. Datos del cliente cifrados con SHA-256 en el adaptador; el motor nunca ve el token. Si Meta falla, el flujo SIGUE y el motivo queda en el resultado. |
| `payment-proof` | `IMPLEMENTADO` (C10) — `runPaymentProofStep`, **sin IA**: descarga el archivo de la variable (`MediaFetcher`, con la misma protección SSRF), lee su texto (`DocumentTextReader`: OCR propio para imágenes, capa de texto para PDF), extrae valor, moneda, fecha, referencia y pagador (`extractReceipt`) y verifica contra las cuentas de recaudo (`verifyReceipt`): cuenta completa o enmascarada (esta solo con la entidad o el titular visibles), titular y sus variantes con tolerancia a errores del OCR, monto exacto o mínimo, antigüedad en la zona del negocio y repetidos (`ReceiptRegistry`, atómico; solo se registra lo que pasa todo lo demás). Una salida por resultado; los datos quedan en `<variable>.valor`, `.referencia`… y el motivo en la variable de error. |
| `set-field` | `IMPLEMENTADO` (2026-11-14) — «Guardar dato» (el Manipulador de Leona): pone el valor con sus variables o hace una cuenta (`applySetField`: sumar, restar, multiplicar, dividir; vacío = 0; sin número o entre 0, no cambia y queda `set_field_<motivo>`). Lo deja en la conversación; si es un Campo del cliente, `FlowTurn` lo pasa a la ficha con su tipo. No toca Datos del negocio (`g_…`) ni lo que llena Auream. Salida única. |
| `go-to-flow` | `IMPLEMENTADO` (2026-11-14) — «Ir a otro flujo» (la Conexión de flujo de Leona): termina (`completed`) y devuelve `NodeExecutionResult.handoff` con los datos de la conversación (sin los `__…`). El motor no conoce otros flujos: el salto lo hace `domains/messaging/application/FlowTurn` con `flowHandoff.ts` (flujo de la cuenta, activo, no el mismo, hasta `GO_TO_FLOW_MAX_CHAIN` = 5 saltos seguidos) en el MISMO turno: el destino arranca con un mensaje `handoff` que trae `carriedContext` (el `ExecutionLoop` lo pone en la sesión nueva). Lo que envían los dos cuenta junto; el historial de turnos lo anota con origen `handoff` (migración 055). Un salto negado queda `go_to_flow_refused:<motivo>`. El laboratorio no salta: lo avisa. Sin salidas. |
| `notification` | `NO IMPLEMENTADO` — falla explícitamente con `*_not_implemented` en lugar de simular un resultado (necesita el canal, FASE D). |

La forma de la configuración de cada bloque es un contrato compartido con el builder (`contracts/*Config.ts`, lectores en `contracts/ConfigReaders.ts`): los dos lados leen lo mismo.

`nodes/ai/AiNodeHandler.ts` es un tipo de nodo del grafo. **No es un agente** ni tiene relación con `domains/ai-agents` ni con el AI Sales Engine. Un flow con nodo de IA sigue siendo determinístico.

### Variables en plantillas

Una sola sintaxis para el builder y el motor (`contracts/TemplateVariables.ts`): `{nombre}`, con valor por defecto `{nombre|texto}` y el formato heredado `{{context.clave}}`.

- **De dónde sale el valor** (`templates/templateResolver.ts`): variables del sistema (`first_name`, `full_name`, `phone`, `email`, `last_message`) → lo guardado en **esta** conversación → la ficha del cliente (campos personalizados) → anuncio → reloj. Lo dicho en la conversación manda sobre la ficha (`values/customFieldValue.ts`): cada vez que un flujo arranca la conversación empieza en blanco, así que nunca es de otro día, y un dato viejo de la ficha no tapa la respuesta nueva. Mismo orden que usa el Condicional.
- **Valores con tipo** (`contracts/FieldValues.ts`): la ficha guarda sí/no, fechas y números «a lo computador». En un mensaje (`text`) salen como persona («Sí», «13/11/1990»); en una integración, el Pixel, Registrar venta o el monto del Comprobante (`raw`, `json`, `url`, `header`) van crudos. El Condicional compara con tipo: «Sí» = `true`, «13/11/1990» = `1990-11-13`, «1.200.000» = `1200000`.
- **Codificación según el destino**: texto tal cual en mensajes; componente de URL, cadena JSON escapada o cabecera sin saltos de línea en la Integración. Un dato del cliente nunca cambia la forma de la petición.
- **Mensajes** (`templates/ConversationTemplates.ts`): Mensaje, Menú y Esperar respuesta resuelven sus textos; el contacto solo se consulta si el texto usa variables.
- **Del sistema, como en Leona** (2026-11-14): reloj en la zona del negocio (`{fecha}` dd/MM/aaaa, `{data}` dd/MM, `{hora}`, `{dia}`, `{saludo}` — 5–11 h «Buenos días», 12–18 h «Buenas tardes», si no «Buenas noches»), `{created_at}` (cuándo llegó el cliente) y `{attendant_name}`, `{instance_name}`, `{instance_number}` (asesor y número de la conversación). Estos tres los lee el puerto `ports/ConversationFactsReader.ts` (`SqlConversationFacts`), **una vez por turno y solo si el flujo los nombra**; en el laboratorio salen de ejemplo.
- **Nombres de Leona** (`contracts/VariableCatalog.ts`, `LEONA_VARIABLE_ALIASES`): `{phone_number}`, `{ai.response}`, `{ai.erro}`, `{ai.fail.reason}`, `{response.erro}` y `{comprovante.*}` valen lo mismo que su nombre en Auream; el alias solo se usa si la variable no existe con su propio nombre.
- **Error de la Integración**: al salir por `failure` queda el motivo en `{integracion.error}` (= `{response.erro}`); un éxito posterior lo borra.
- **Condicional con variables**: el «valor» de una regla puede llevar `{…}` (`{data}`, `{ref_anterior}`); se resuelve en crudo antes de comparar.
- **En el editor**: cada campo de texto tiene el botón «{ } Variables» (`_kit/variables`), con buscador y por grupos (del cliente, campos del cliente, datos del negocio, del sistema, del anuncio, de otros bloques); la pone donde está el cursor.

### Peticiones salientes (Integración)

El motor declara `ports/HttpRequester.ts`; la composición inyecta `infrastructure/http/SafeHttpRequester.ts`:

- **SSRF**: solo Internet público. La IP se valida después de resolver el DNS y es la misma con la que se conecta; IP escritas en la URL, redirecciones e IPv4 dentro de IPv6 incluidas (`blockedAddresses.ts`).
- **Límites**: 10 s en total, 3 redirecciones (sin `Authorization` ni `Cookie` al cambiar de origen), cuerpo enviado ≤ 256 KB, respuesta ≤ 1 MB también tras descomprimir.
- `INTEGRATIONS_ALLOW_PRIVATE_NETWORK=true` permite la red privada **solo en desarrollo**; la API no arranca con él en producción.
- Sin red (tests): `DisabledHttpRequester`, que el bloque trata como un fallo más.

«Probar» del editor (`POST /api/builder/integrations/test`, permiso `flows.write`, 20 pruebas por minuto y cuenta) recorre el mismo código que el bloque (`runIntegrationRequest` + `mapResponseFields`) con valores de ejemplo, y devuelve las rutas de la respuesta para elegir qué guardar.

### Producción: mensajes reales

```
uazapi ─POST /webhooks/uazapi─▶ routeWhatsAppWebhooks  (verifica el token; responde 200 y sigue con waitUntil)
   └▶ domains/messaging · HandleInboundMessageService
        registro (sin duplicados) → candado por conversación → contacto
        → flujo en curso (sesión viva) o disparador del número
        → ExecutionOrchestrator de PRODUCCIÓN (composeMessagingServices)
             SavedFlowRegistry (lo guardado es lo que corre) · SqlSessionRepository
             contactos, turnos, comprobantes en SQL · IA/píxel/integraciones de la cuenta
        → ConnectionChannelServices.deliver → UazapiMessenger (texto, archivos, menús, reacciones; pausas ≤ 20 s)
        → registro con el resultado
```

- Una sesión por conversación (`<tenant>:<conexión>:<teléfono>`). Si el flujo terminó o falló, el siguiente mensaje empieza uno nuevo (`SessionService.getOrCreateActive`).
- Mientras un cliente está dentro de un flujo, sus mensajes lo continúan: los disparadores no lo interrumpen.
- El candado de conversación usa un pool de conexiones propio: nunca compite con el trabajo.
- Despertadores (C6, [task-queue.md](task-queue.md)): Programador, «Tiempo agotado» de Esperar respuesta y Menú, y pausas que no caben en un turno (más de 20 s sumadas) los retoma la cola de tareas.

### Comprobantes (lectura sin IA)

```
PaymentProofNodeHandler → runPaymentProofStep
   ├── ports/MediaFetcher        → SafeHttpRequester.fetch (SSRF, 10 MB, 15 s)
   ├── ports/DocumentTextReader  → TesseractDocumentReader
   │       imagen: sharp (enderezar, gris, invertir modo oscuro, ~2000 px) → Tesseract (spa, LSTM)
   │       PDF:    capa de texto (unpdf); un PDF escaneado es «ilegible»
   └── ports/ReceiptRegistry     → SqlReceiptRegistry (`010_payment_proof_receipts.sql`)
```

- Todo corre en el servidor: sin claves ni coste por uso. El modelo de español viaja en el paquete `@tesseract.js-data/spa` (sin descargas al arrancar); un motor de OCR por instancia, reutilizado mientras la función siga caliente.
- El texto leído no se guarda: solo la huella del comprobante (referencia, o un resumen sha-256 de sus datos) para detectar repetidos.
- «Probar» (`POST /api/builder/payment-proof/test`, `flows.write`, 10 por minuto y cuenta, archivo ≤ 2,5 MB que el editor reduce antes de enviar) recorre el mismo código sin registrar el comprobante: solo consulta si ya se usó.

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

El motor no se ensambla a sí mismo. `apps/api/composition/` construye el `NodeRuntime` con sus handlers y, para la simulación del builder, un motor aislado por turno mediante `composeSimulationSandbox` (laboratorio de pruebas, ver `automations.md`).

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
