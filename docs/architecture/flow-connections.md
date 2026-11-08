# Conexiones entre bloques

`contracts/FlowConnectionRules.ts` · `apps/web/src/features/automations/builder/services/connectionRules.ts` · `domains/automations/validation/`

## Qué es

Las reglas que deciden **cómo se pueden conectar los bloques** de una automatización. Son las mismas en tres puntos:

1. **Al conectar en el lienzo:** la conexión no permitida no se crea y se explica por qué.
2. **Al validar el lienzo:** el builder avisa de problemas en flujos ya construidos.
3. **Al publicar:** el backend rechaza la versión (`GraphValidator`).

Siguen el mismo modelo que los bloques equivalentes de Leona, que es la referencia funcional del producto.

## El modelo

Cada bloque tiene **salidas**. Una conexión dice de qué bloque sale, **por cuál salida** y a qué bloque llega.

| Regla | Detalle |
|---|---|
| **Una conexión por salida** | De cada salida sale como mucho una conexión. Para llevar el flujo a dos sitios se usa un bloque con varias salidas (Distribuidor, Condicional, Menú…). |
| **Entradas ilimitadas** | A un bloque pueden llegar todas las conexiones que se quiera. |
| **Inicio** | No recibe conexiones y tiene una sola salida, hacia el primer paso. |
| **Sin auto-conexión** | Un bloque no se conecta consigo mismo. |
| **La salida debe existir** | Solo se puede conectar desde una salida que la configuración actual del bloque ofrece. Si una salida desaparece (se borra una opción del Menú, se activa «sin límite»…), sus conexiones se eliminan solas. |
| **Ciclos** | Se permiten si pasan por un bloque que **espera** (Esperar respuesta, Menú, Programador): cada vuelta se detiene. Un ciclo sin ninguno de ellos sería infinito y se rechaza. |

## Salidas de cada bloque

| Bloque | Salidas | Id persistido (`fromOutput`) |
|---|---|---|
| Mensaje, Programador, Etiquetas, Pixel, Notificación | Una, implícita | — |
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

| Regla | Lienzo (al conectar) | Builder (validación) | Backend (publicar) |
|---|---|---|---|
| Una conexión por salida con nombre | `checkConnection` | `findOvercrowdedOutputs` | — (el snapshot de ejecución no lleva `fromOutput`) |
| Una conexión en bloques de salida única | `checkConnection` | `findOvercrowdedOutputs` | `validateOutgoingLimits` (`NODE_TOO_MANY_OUTGOING`) |
| Inicio con una sola salida | `checkConnection` | `findOvercrowdedOutputs` | `validateOutgoingLimits` (`ENTRY_TOO_MANY_OUTGOING`) |
| Nada entra a Inicio | `checkConnection` (y el nodo no tiene punto de entrada) | — | — |
| Sin auto-conexión | `checkConnection` | — | — |
| La salida existe | `checkConnection` + poda automática (`pruneCanvasEdges`) | — | — |
| Ciclos solo a través de bloques que esperan | — | aviso | `detectCycles` (`INFINITE_CYCLE`) |

Las listas compartidas viven en `contracts/FlowConnectionRules.ts`:

- `SINGLE_OUTPUT_NODE_TYPES`: bloques de salida única. Un test de contrato comprueba que coincide con las herramientas sin `outputs()`.
- `PAUSING_NODE_TYPES`: bloques que esperan.

Los escenarios compartidos de `tests/fixtures/validation/scenarios.ts` comprueban que el builder y el backend dan el mismo veredicto.

## Experiencia en el lienzo

- **Mientras se arrastra** una conexión, un destino no permitido se marca como no válido (`isValidConnection` de React Flow).
- **Al soltar** sobre un destino no permitido, aparece un aviso breve con el motivo. Por ejemplo: «Esa salida ya está conectada. Elimina la conexión actual para cambiar su destino.»
- `useBuilderController` vuelve a comprobar la regla antes de crear la arista: nada entra al grafo sin pasar por `checkConnection`.
- Las conexiones se dibujan como curvas **sin punta de flecha**. La dirección la dan los puntos de salida (derecha) y entrada (izquierda) de cada bloque.

## Decisiones

- **Rechazar, no reemplazar.** Conectar desde una salida ocupada no sustituye la conexión anterior en silencio: se avisa y el usuario decide. Así no se pierde una rama sin querer.
- **El fallback de Esperar respuesta ya no es obligatorio.** La regla anterior (`QUESTION_NO_FALLBACK`) exigía una arista de rescate. Con el modelo de salidas, el caso «no respondió» es la salida «Tiempo agotado», y una espera sin límite tiene una sola salida legítima.

## Pendiente (Fase C)

El motor (`EdgeEvaluator`) todavía no elige la arista por su salida de origen. Para que la ejecución respete este modelo:

1. `fromOutput` debe viajar del snapshot del builder al de ejecución.
2. Cada handler debe declarar en su resultado por cuál salida sigue: `respuesta`/`tiempo-agotado`, `true`/`false`, el turno del Distribuidor, la opción del Menú…
3. `EdgeEvaluator` debe seleccionar la arista de esa salida.

Hasta entonces, la regla «una conexión por salida con nombre» la garantiza el builder y no el backend.
