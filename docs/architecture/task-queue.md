# Cola de tareas y despertadores de los flujos (FASE C6)

`domains/scheduling` · `infrastructure/persistence/sql/SqlTaskRepository.ts` · `019_scheduled_tasks.sql` · `domains/messaging/application/FlowTimerService.ts` · `apps/api/routes/routeInternalTasks.ts` · `infrastructure/scheduling/VercelQueueTaskAlarm.ts` · `apps/api/bootstrap/composeTaskAlarmConsumer.ts` · `api/task-alarm.ts`

## Qué resuelve

Un flujo a veces debe seguir **más tarde**: el Programador («espera 3 minutos», «el lunes a las 8»), el «Tiempo agotado» de Esperar respuesta y del Menú, o una pausa de un Mensaje que no cabe en un turno. Vercel no tiene procesos que esperen, así que el motor **no espera**: declara cuándo despertar y una cola en Neon lo despierta a su hora.

## Piezas y responsabilidades

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| Motor (`flow-engine`) | Cada bloque declara su hora (`resumeAt`, `waitDeadlineAt`); el turno devuelve `FlowRunResult.wakeUp`. Al despertar, el bloque recibe `input.timer` y decide (seguir, «Tiempo agotado»). Descarta despertadores viejos. | colas, HTTP, bases |
| `domains/scheduling` | Cola **genérica**: programar (sin duplicados, una pendiente por grupo), reservar de forma atómica, ejecutar con su manejador, reintentar espaciado, dar por fallida, limpiar. Decide quién despierta al trabajador: ya (vence en segundos) o un despertador a su hora (`TaskAlarm`). | flujos, WhatsApp, Vercel |
| `infrastructure/scheduling` | Cómo se despierta: por HTTP (`HttpTaskKicker`), en el proceso, o con un mensaje con retraso de Vercel Queues (`VercelQueueTaskAlarm`). | qué tareas hay |
| `composeTaskAlarmConsumer` (`api/task-alarm.ts`) | Consumidor de Vercel Queues: cuando suena un despertador, llama al trabajador de **producción**. No toca la base ni WhatsApp. Usa el manejador web de la librería con `webHandlerOnNode` (ver «Ayudas de Vercel»). | — |
| `domains/messaging` | `FlowTurn`: un turno de flujo (motor → envío → bandeja → despertador), igual para mensaje, envío a mano y despertador. `FlowTimerService`: qué pasa cuando vence. | la cola concreta |
| `apps/api/composition` | Une las dos orillas con adaptadores (`SchedulerFlowTimers`, `FlowTimerTaskHandler`). Ningún dominio importa al otro. | — |
| `apps/api/routes/routeInternalTasks.ts` | `/internal/tasks/run`: despierta al trabajador. Solo con `CRON_SECRET`. | — |

## Recorrido

```
mensaje / envío a mano / despertador
        │
        ▼
  FlowTurn ──> motor ──> respuestas por WhatsApp ──> bandeja
        │                     │
        │          FlowRunResult.wakeUp (bloque, revisión, hora)
        ▼
  SchedulerFlowTimers ──> TaskScheduler.replaceInGroup   (una pendiente por chat)
                                   │                 │ vence en minutos, horas o días
                           scheduled_tasks (Neon)    └─> despertador: mensaje con retraso
                                   │  vence               en Vercel Queues (suena a su hora)
  despertador (Vercel Queues) ─┐   ▼                              │
  autoinvocación (segundos) ───┤                    api/task-alarm.ts (consumidor)
  tráfico de la app y ─────────┼─> /internal/tasks/run <──────────┘
  mensajes (vence en segundos) │        │
  Vercel Schedules (15 min) ───┘        ▼
                              TaskRunner ──> FlowTimerTaskHandler ──> FlowTimerService.fire
                                   │                                  (candado del chat) ──> FlowTurn
                                   └─> al terminar: armNext (el despertador de la siguiente pendiente)
```

## Reglas

- **Una pendiente por conversación.** Cada turno que cambia la sesión reemplaza el despertador del chat (`groupKey = conversation:<clave>`). Un turno que no la cambia (`untouched`) no toca nada.
- **Sin duplicados.** `dedupeKey` = sesión + revisión + motivo.
- **Despertadores vencidos.** Valen solo si la sesión sigue en el mismo bloque y la misma revisión; si no, no hacen nada.
- **Durante un Programador** los mensajes del cliente no mueven el flujo. La sesión recuerda la hora (`WAKE_CONTEXT_KEY`): si un mensaje llega cuando ya pasó (p. ej. con el bot pausado), el flujo sigue en ese momento.
- **Bot pausado** (atiende un asesor): el despertador no mueve nada.
- **Número eliminado:** nada se envía.
- **Pausas en un Mensaje:** pueden sumar hasta `INLINE_PAUSE_BUDGET_MS` (20 s) por turno. La que no cabe detiene el flujo y el despertador retoma el mismo bloque justo después de ella, sin desordenar nada.
- **Programador:** `resolveResumeAt` calcula la hora con la espera o la fecha, y aplaza a la siguiente franja si hay horario. Todo en la zona horaria del negocio.
- **Las esperas cuentan desde el último mensaje.** El Intervalo y el tiempo máximo de Esperar respuesta y del Menú empiezan cuando sale el último mensaje del turno, después de sus pausas de «escribiendo…» (`waitStartsAt`), no cuando empezó el turno. Y como enviar a WhatsApp también tarda, cada espera relativa lleva desde cuándo la planeó el motor (`FlowWakeUp.from`) y `FlowTurn` la corre exactamente lo que la entrega real se pasó (`alignWakeUpToDelivery`). Las horas fijas (una fecha, el inicio de una franja del horario) no se mueven.

## El trabajador (`TaskRunner`)

Una **ronda** con tiempo limitado (`TASK_RUNNER_BUDGET_MS`, 50 s por defecto, por debajo del `maxDuration` de 60 s):

1. Reserva cada tarea **en su hora** con `for update skip locked`, así dos rondas a la vez nunca toman la misma. Cada reserva dura 2 min.
2. La arranca sin esperar a las que ya corren (hasta 16 a la vez): un turno largo, con 20 s de pausas, no atrasa el intervalo de otro chat. Cada turno ocupa un candado de su conversación mientras dura; caben 20 por instancia.
3. Si salen bien, quedan como `done`. Si fallan, reintenta a los 30 s, 2 min, 8 min, 32 min y luego cada 1 h, hasta 5 intentos. Al agotarlos, o con `PermanentTaskError`, quedan como `failed` con su motivo.
4. Si no hay vencidas pero alguna vence antes de que termine la ronda, la **espera hasta el milisegundo de su hora** (de a 2 s como mucho, por si llega algo antes). Así una pausa de 30 s no aguarda a la próxima ronda.
5. Solo toma tareas si quedan 25 s para terminarlas. Si el proceso muere, la reserva caduca y otra ronda la retoma, por eso los manejadores son idempotentes.
6. Borra las terminadas de más de 7 días.

## Quién despierta al trabajador

| Disparador | Cuándo | Para qué |
|---|---|---|
| Autoinvocación (`HttpTaskKicker`) | Al programar algo que vence en menos de 20 s (lo que una ronda alcanza a esperar: su tiempo menos la reserva; `kickHorizonFor`) | Arranca la ronda enseguida; la ronda espera la hora exacta |
| **Despertador** (`VercelQueueTaskAlarm`, Vercel Queues) | Al programar algo que vence más tarde, y al terminar cada ronda para la siguiente pendiente (`armNext`) | Programador, «Tiempo agotado» y pausas de minutos, horas o días, **a su hora**, sin cron frecuente ni funciones esperando. Mensaje con retraso al tema `auream-task-alarms` que suena **15 s antes** (`ALARM_LEAD_MS`): la ronda llega con margen y espera la hora exacta. Tareas en el mismo tramo de 5 s comparten uno. Más de 6 días: suena a los 6 y esa ronda arma el siguiente |
| Tráfico de la API (`wakeTasksOnTraffic`) y mensajes entrantes (`nudgeIfDue`) | Primera petición de cada instancia: `armNext`. Después, como mucho cada 10 s por instancia (y con cada mensaje entrante): si algo ya venció o vence en menos de 20 s. Las peticiones del propio trabajador no cuentan | Red de seguridad con exactitud: mientras alguien usa la app (el panel abierto pregunta cada pocos segundos), lo que vence sigue a su hora aunque se pierda su despertador |
| Vercel Schedules → `POST /api/internal/tasks/run` (`tasks-sweep` en `vercel.json`) | **Cada 15 min**: lo más seguido que permite Hobby, con 15 min de margen de Vercel. En Pro se puede cada minuto (`* * * * *`) | Revisión periódica (red de seguridad): sin nadie usando la app, lo que se pase por un despertador perdido se atiende en menos de 30 min. Reemplazó al Vercel Cron diario |
| Cadena de rondas (`continueIfSoon`) | Solo **sin despertadores** (`TASK_ALARMS=off`): al terminar cada ronda, si algo vence dentro del margen | La ronda se sostiene (`holdWithinMs`) y despierta a la siguiente. Una sola cadena: eslabón con clave única por tramo de 30 s (`scheduling.chain`) |
| Servidor local (`apps/api/main.ts`) / `apps/worker` | Rondas seguidas | Desarrollo y servidor propio |

**El despertador solo suena.** El mensaje de Vercel Queues no lleva trabajo: el consumidor (`composeTaskAlarmConsumer`, servido por `api/task-alarm.ts`) llama a `POST /api/internal/tasks/run` del dominio de **producción** con `CRON_SECRET`, y la ronda corre lo vencido en Neon. Vercel entrega cada mensaje al mismo despliegue que lo envió; como ese despliegue solo «toca el timbre», un despertador armado antes de un despliegue nuevo nunca corre código viejo. Si el trabajador no responde, el consumidor lanza y Vercel Queues reintenta cada 30 s durante una hora.

**Despertadores perdidos.** Al terminar cada ronda se arma el de la siguiente pendiente (`armNext`), y también con la **primera petición de cada instancia** de la API (dentro de una petición, donde está la credencial de Vercel Queues). Así un despertador que no se pudo enviar, o que armó un despliegue anterior con un consumidor roto, se recupera solo.

**Cómo leer el tablero de Vercel Queues.** «Queued» cuenta cada vez que se arma un despertador, y el de la próxima pendiente se vuelve a armar con la primera petición de cada instancia y al final de cada ronda: Vercel descarta los repetidos (misma clave), pero los cuenta. Además, cada despliegue guarda su propia copia, así que cuando vence suenan varias a la vez (una por despliegue que la armó) y el trabajador despierta varias veces sin repetir nada (la reserva es atómica). Por eso «Queued» es mucho mayor que «Received», y las entregas llegan en tandas a la hora de cada tarea: no son despertadores perdidos. Para medir la puntualidad, mira `tasks.alarm_rang` (`lateMs`) y `tasks.late` en el registro.

**Ayudas de Vercel (`NODEJS_HELPERS=0`).** El proyecto las apaga porque la API lee el cuerpo de las peticiones ella misma, y eso vale para **todas** las funciones: no hay `req.body` ni `res.status()`. El consumidor de la librería para `(req, res)` (`handleNodeCallback`) depende de las dos: con él cada entrega fallaba sin llamar a nadie y los intervalos solo seguían si otra cosa despertaba la cola (incidente del 2026-11-09). Por eso el consumidor usa el manejador web (`handleCallback`) servido con `webHandlerOnNode`, y `tests/unit/taskAlarmConsumer.test.ts` lo prueba con una entrega igual a la de Vercel en un servidor de Node sin ayudas.

**Plan Hobby, puntualidad y consumo.** Con despertadores, cada espera cuesta un mensaje de la cola y dos invocaciones cortas, sin funciones esperando: el Programador de 3 minutos, el «Tiempo agotado» de 2 horas o una pausa de 2 días llegan a su hora en Hobby. El plan Hobby es solo para uso personal, no comercial: para vender el servicio a clientes hace falta el plan Pro. Si Vercel Queues fallara (`tasks.alarm_failed` en el registro), lo vencido se atiende con el tráfico de la app (a su hora), la próxima ronda o la revisión cada 15 minutos; con `TASK_ALARMS=off` vuelve la cadena de rondas.

## Puntualidad

Una espera de 3 minutos sigue a los 3 minutos exactos de que el cliente recibió el último mensaje, con estas piezas:

| Riesgo de atraso | Cómo se evita |
|---|---|
| El reloj | Vercel (AWS) y Neon toman la hora de internet (NTP). Medido el 2026-11-09: Neon a unas 5 milésimas de la hora de Google y Apple. Todas las horas se guardan en UTC; la zona del negocio solo cuenta para fechas y horarios. |
| Desde cuándo se cuenta | Desde que salió el último mensaje: las pausas del turno (`waitStartsAt`) y lo que tardaron los envíos (`alignWakeUpToDelivery`). |
| La demora de la cola y el arranque de las funciones | El despertador suena 15 s antes y la ronda espera la hora exacta. Lo que vence en menos de 20 s despierta al trabajador ya. |
| Otros chats ocupando al trabajador | Cada tarea se toma en su hora aunque otras sigan en curso (16 a la vez por ronda; otras rondas en paralelo). |
| La espera dentro de la ronda | Hasta el milisegundo de la hora; reservar y comparar usan el mismo reloj. |

Medido contra Neon (rama test) desde Colombia, con un turno de 15 s corriendo en medio: cada tarea se tomó entre 92 y 204 ms después de su hora, que es una ida y vuelta a la base desde allí (86–110 ms). En producción la función (Cleveland) y la base (Ohio) están a milésimas. Lo que queda es el propio envío a WhatsApp (fracciones de segundo), igual que en cualquier plataforma.

En el registro: `tasks.alarm_rang` (`lateMs`: cuánto tardó Vercel Queues respecto de la hora pedida; con menos de 15 s no atrasa nada), `tasks.round` (`maxLateMs`: cuán tarde se tomó la tarea más tardía de la ronda; lo normal son milésimas) y `tasks.late` (más de un minuto: algo no la despertó).

## Configuración

| Variable | Para qué |
|---|---|
| `CRON_SECRET` | **Obligatoria en producción.** Protege `/internal/tasks/run` (Vercel Schedules la envía como `Authorization: Bearer …`). Mínimo 16 caracteres. Sin ella el endpoint responde 503 y la cola solo corre dentro del proceso. |
| `TASK_RUNNER_BUDGET_MS` | Duración de una ronda (10 000–290 000; por defecto 50 000). |
| `TASKS_BASE_URL` | Dirección pública de la API para la autoinvocación (por defecto, el dominio de producción de Vercel). |
| `TASK_ALARMS` | Despertadores con Vercel Queues: `on` u `off`. Por defecto `on` en Vercel con `CRON_SECRET`, `off` en local. |
| `TASK_CHAIN_HORIZON_MS` | Margen de la cadena de rondas (por defecto 0 con despertadores y 900 000 = 15 min sin ellos; 0 la apaga). |

## Operación

- Tareas pendientes: `select kind, due_at, attempts from scheduled_tasks where status = 'pending' order by due_at`.
- Fallidas recientes: `select kind, last_error, finished_at from scheduled_tasks where status = 'failed' order by finished_at desc limit 20`.
- Registro de la función: `tasks.alarm_rang` (un despertador llegó, con su demora), `tasks.round` (lo que hizo cada ronda, con `maxLateMs`: lo más tarde que corrió una tarea), `tasks.late` (una tarea corrió más de un minuto tarde: algo no la despertó a su hora), `tasks.attempt_failed` (cada intento fallido con su motivo) y `tasks.alarm_failed` (un despertador que no se pudo armar). En Hobby el registro solo guarda la última hora.
- Despertadores: en Vercel → el proyecto → Queues (tema `auream-task-alarms`); el consumidor es la función `api/task-alarm.ts`.
- Revisión cada 15 min: en Vercel → el proyecto → Schedules (`tasks-sweep`), con su historial; «Run Schedule» la corre en el momento.
