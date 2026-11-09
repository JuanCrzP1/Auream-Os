# Conexiones entre bloques

`contracts/FlowConnectionRules.ts` · `apps/web/src/features/automations/builder/services/connectionRules.ts` · `domains/automations/validation/`

## Qué es

Las reglas que deciden **cómo se pueden conectar los bloques** de una automatización. Son las mismas en tres puntos:

1. **Al conectar en el lienzo:** la conexión no permitida no se crea y se explica por qué.
2. **En la revisión del flujo:** el builder lista los problemas de un flujo ya construido y lleva a cada bloque (`reviewFlow`).
3. **En el backend:** `GraphValidator` responde si el grafo puede ejecutarse. Los flujos no se publican (se autoguardan), así que ninguno de los dos bloquea el guardado.

Siguen el mismo modelo que los bloques equivalentes de Leona, que es la referencia funcional del producto.

## El modelo

Cada bloque tiene **salidas**. Una conexión dice de qué bloque sale, **por cuál salida** y a qué bloque llega.

| Regla | Detalle |
|---|---|
| **Una conexión por salida** | De cada salida sale como mucho una conexión. Para llevar el flujo a dos sitios se usa un bloque con varias salidas (Distribuidor, Condicional, Menú…). |
| **Entradas ilimitadas** | A un bloque pueden llegar todas las conexiones que se quiera. |
| **Inicio** | Bloque de sistema `start`, uno por flujo. No recibe conexiones y tiene una sola salida, hacia el primer paso. Ver [El bloque de inicio](#el-bloque-de-inicio). |
| **Sin auto-conexión** | Un bloque no se conecta consigo mismo. **Única excepción, como en Leona:** «Otra respuesta» del Menú puede volver al mismo Menú para mostrarlo de nuevo cuando el cliente escribe algo que no es una opción (`canConnectToItself`). «Tiempo agotado» no, porque reenviaría el menú sin fin a quien no contesta. |
| **La salida debe existir** | Solo se puede conectar desde una salida que la configuración actual del bloque ofrece. Si una salida desaparece (se borra una opción del Menú, se activa «sin límite»…), sus conexiones se eliminan solas. |
| **Ciclos** | Se permiten si pasan por un bloque que **espera** (Esperar respuesta, Menú, Programador): cada vuelta se detiene. Un ciclo sin ninguno de ellos sería infinito y se rechaza. |

## Salidas de cada bloque

| Bloque | Salidas | Id persistido (`fromOutput`) |
|---|---|---|
| Inicio (sistema), Mensaje, Programador, Etiquetas, Pixel, Notificación | Una, implícita | — |
| Esperar respuesta | Respuesta; Tiempo agotado (solo con límite de tiempo) | `respuesta`, `tiempo-agotado` |
| Condicional | Se cumple; No se cumple | `true`, `false` |
| Integración | Éxito; Error | `success`, `failure` |
| Distribuidor | Una por salida configurada (reparto por turnos) | id de cada salida |
| Menú | Una por opción; Otra respuesta; Tiempo agotado (con límite) | id de cada opción, `menu-other`, `menu-timeout` |
| Extensión IA | Sin intenciones: Respuesta y Error. Con intenciones: una por intención, respaldo y Error | `success`/`failure`, o id de cada intención, `fallback`, `failure` |
| Comprobante automático | Válido; una por verificación activa (cuenta, titular, monto, antigüedad, repetido); No es un comprobante; Error | `valid`, `wrong-key`, `wrong-recipient`, `wrong-amount`, `too-old`, `duplicate`, `invalid`, `failure` |
| Finalizar (sistema) | Ninguna: cierra la rama | — |

Los ids son **datos persistidos**: cambiar uno desconecta las aristas guardadas. Las salidas las declara cada herramienta con `outputs(config)` (ver [builder-tools.md](builder-tools.md)).

## Dónde se aplica cada regla

| Regla | Lienzo (al conectar) | Builder (revisión del flujo) | Backend (`GraphValidator`) |
|---|---|---|---|
| Una conexión por salida con nombre | `checkConnection` | `findOvercrowdedOutputs` | — (el snapshot de ejecución no lleva `fromOutput`) |
| Una conexión en bloques de salida única | `checkConnection` | `findOvercrowdedOutputs` | `validateOutgoingLimits` (`NODE_TOO_MANY_OUTGOING`) |
| Inicio con una sola salida | `checkConnection` | `findOvercrowdedOutputs` | `validateOutgoingLimits` (`ENTRY_TOO_MANY_OUTGOING`) |
| Nada entra a Inicio | `checkConnection` (y el nodo no tiene punto de entrada) | `reviewFlow` | `validateStartBlock` (`ENTRY_HAS_INCOMING`) |
| El flujo empieza en un `start`, y solo hay uno | — (no está en la paleta, no se borra ni se duplica) | `reviewFlow` | `validateStartBlock` (`ENTRY_NODE_NOT_START`, `START_NODE_NOT_ENTRY`) |
| Sin auto-conexión (salvo «Otra respuesta» del Menú) | `checkConnection` + `canConnectToItself` | — | — (el ciclo pasa por un bloque que espera) |
| La salida existe | `checkConnection` + poda automática (`pruneCanvasEdges`) | — | — |
| Ciclos solo a través de bloques que esperan | — | aviso | `detectCycles` (`INFINITE_CYCLE`) |

Las listas compartidas viven en `contracts/FlowConnectionRules.ts`:

- `SINGLE_OUTPUT_NODE_TYPES`: bloques de salida única. Un test de contrato comprueba que coincide con las herramientas sin `outputs()`.
- `PAUSING_NODE_TYPES`: bloques que esperan.
- `canConnectToItself(tipo, salida)`: qué salida puede volver a su propio bloque (hoy solo `menu` / `menu-other`).

Los escenarios compartidos de `tests/fixtures/validation/scenarios.ts` comprueban que el builder y el backend dan el mismo veredicto.

## El bloque de inicio

Todo flujo empieza en un bloque **Inicio** (tipo `start`, `contracts/FlowEntry.ts`), igual que en Leona:

- Es un nodo de **sistema**: se crea con el flujo, no está en la paleta, no se borra, no se duplica y no se edita.
- Es el `entryNodeId` de la versión. El builder lo deriva del nodo marcado como entrada en el lienzo, así que nunca puede quedar apuntando a un nodo que ya no existe.
- En ejecución **no hace nada**: `StartNodeHandler` pasa al siguiente bloque sin enviar mensajes.
- Será el sitio de los **disparadores** del flujo (palabras clave, anuncios…).

**Migración de flujos antiguos.** Antes, el inicio era un bloque Mensaje con el texto «Inicio del flujo», que el motor habría enviado a cada cliente. `ensureStartEntry` corrige al leer:

| Caso guardado | Resultado |
|---|---|
| Mensaje sembrado «Inicio del flujo» | Pasa a `start` en su sitio: mismo id, posición y conexiones |
| La entrada es un bloque real (un Mensaje con contenido propio…) | Se inserta un `start` delante, conectado a él: el flujo se comporta igual |
| La entrada no existe (flujo vacío o roto) | Se crea un `start` |

La aplica `UpgradingBuilderWorkspaceRepository`, un decorador del repositorio de workspaces: toda lectura (builder, listado del Hub, renombrar) sale migrada, sea cual sea la base de datos. El siguiente autoguardado deja el formato nuevo en disco. Las migraciones futuras se añaden en `upgradeWorkspace`, nunca en un caso de uso.

## Experiencia en el lienzo

- **Mientras se arrastra** una conexión, un destino no permitido se marca como no válido (`isValidConnection` de React Flow).
- **Al soltar** sobre un destino no permitido, aparece un aviso breve con el motivo. Por ejemplo: «Esa salida ya está conectada. Elimina la conexión actual para cambiar su destino.»
- `useBuilderController` vuelve a comprobar la regla antes de crear la arista: nada entra al grafo sin pasar por `checkConnection`.
- Las conexiones se dibujan como curvas **sin punta de flecha**. La dirección la dan los puntos de salida (derecha) y entrada (izquierda) de cada bloque.
- La conexión que **vuelve al mismo bloque** se dibuja como un lazo por debajo del bloque (`selfLoopPath`): sale por la derecha, pasa por debajo y entra por la izquierda, sin atravesarlo.
- En el motor, al volver al Menú la sesión queda activa (`moveToNode(..., "active")`): el Menú se envía otra vez y espera; el mismo mensaje no cuenta dos veces como respuesta.

## Decisiones

- **Rechazar, no reemplazar.** Conectar desde una salida ocupada no sustituye la conexión anterior en silencio: se avisa y el usuario decide. Así no se pierde una rama sin querer.
- **El fallback de Esperar respuesta ya no es obligatorio.** La regla anterior (`QUESTION_NO_FALLBACK`) exigía una arista de rescate. Con el modelo de salidas, el caso «no respondió» es la salida «Tiempo agotado», y una espera sin límite tiene una sola salida legítima.

## En el motor (FASE C14)

La ejecución respeta este modelo:

1. `fromOutput` viaja del snapshot del builder al de ejecución (`convertBuilderSnapshotToRuntime` → `FlowEdge.fromOutput`).
2. Cada handler declara por qué salida sigue en `NodeExecutionResult.output` (`respuesta`/`tiempo-agotado`, `true`/`false`, el turno del Distribuidor, la opción del Menú…).
3. `EdgeEvaluator` sigue la conexión de esa salida. **Si la salida no está conectada, la rama termina** (`completed`, evento `output_not_connected:<bloque>:<salida>`): es una decisión del usuario, no un error. Un bloque de salida única, o un flujo guardado antes de las salidas con nombre, sigue por condiciones de arista y rescate.

Hoy declaran su salida «Esperar respuesta» (`respuesta`), Condicional (`true`/`false`), Menú (la opción elegida o `menu-other`) y Distribuidor (la salida del turno). Integración, Extensión IA y Comprobante lo harán al implementarse (C10); «tiempo agotado» llega con la cola de tareas (C6).
