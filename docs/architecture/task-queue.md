# Cola de tareas y despertadores de los flujos (FASE C6)

`domains/scheduling` · `infrastructure/persistence/sql/SqlTaskRepository.ts` · `019_scheduled_tasks.sql` · `domains/messaging/application/FlowTimerService.ts` · `apps/api/routes/routeInternalTasks.ts` · `infrastructure/scheduling/VercelQueueTaskAlarm.ts` · `api/task-alarm.ts`

## Qué resuelve

Un flujo a veces debe seguir **más tarde**: el Programador («espera 3 minutos», «el lunes a las 8»), el «Tiempo agotado» de Esperar respuesta y del Menú, o una pausa de un Mensaje que no cabe en un turno. Vercel no tiene procesos que esperen, así que el motor **no espera**: declara cuándo despertar y una cola en Neon lo despierta a su hora.

## Piezas y responsabilidades

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| Motor (`flow-engine`) | Cada bloque declara su hora (`resumeAt`, `waitDeadlineAt`); el turno devuelve `FlowRunResult.wakeUp`. Al despertar, el bloque recibe `input.timer` y decide (seguir, «Tiempo agotado»). Descarta despertadores viejos. | colas, HTTP, bases |
| `domains/scheduling` | Cola **genérica**: programar (sin duplicados, una pendiente por grupo), reservar de forma atómica, ejecutar con su manejador, reintentar espaciado, dar por fallida, limpiar. Decide quién despierta al trabajador: ya (vence en segundos) o un despertador a su hora (`TaskAlarm`). | flujos, WhatsApp, Vercel |
| `infrastructure/scheduling` | Cómo se despierta: por HTTP (`HttpTaskKicker`), en el proceso, o con un mensaje con retraso de Vercel Queues (`VercelQueueTaskAlarm`). | qué tareas hay |
| `api/task-alarm.ts` | Consumidor de Vercel Queues: cuando suena un despertador, llama al trabajador de **producción**. No toca la base ni WhatsApp. | — |
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
  mensaje entrante (si hay ────┼─> /internal/tasks/run <──────────┘
  vencidas)                    │        │
  Vercel Cron (diario) ────────┘        ▼
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

## El trabajador (`TaskRunner`)

Una **ronda** con tiempo limitado (`TASK_RUNNER_BUDGET_MS`, 50 s por defecto, por debajo del `maxDuration` de 60 s):

1. Reserva las vencidas por lotes con `for update skip locked`, así dos rondas a la vez nunca toman la misma. Cada reserva dura 2 min.
2. Las ejecuta (4 a la vez) con el manejador de su tipo.
3. Si salen bien, quedan como `done`. Si fallan, reintenta a los 30 s, 2 min, 8 min, 32 min y luego cada 1 h, hasta 5 intentos. Al agotarlos, o con `PermanentTaskError`, quedan como `failed` con su motivo.
4. Si no hay vencidas pero alguna vence antes de que termine la ronda, la **espera**. Así una pausa de 30 s no aguarda a la próxima ronda.
5. Solo toma tareas si quedan 25 s para terminarlas. Si el proceso muere, la reserva caduca y otra ronda la retoma, por eso los manejadores son idempotentes.
6. Borra las terminadas de más de 7 días.

## Quién despierta al trabajador

| Disparador | Cuándo | Para qué |
|---|---|---|
| Autoinvocación (`HttpTaskKicker`) | Al programar algo que vence en menos de 45 s | Arranca la ronda enseguida; la ronda espera la hora exacta |
| **Despertador** (`VercelQueueTaskAlarm`, Vercel Queues) | Al programar algo que vence más tarde, y al terminar cada ronda para la siguiente pendiente (`armNext`) | Programador, «Tiempo agotado» y pausas de minutos, horas o días, **a su hora**, sin cron frecuente ni funciones esperando. Mensaje con retraso al tema `auream-task-alarms`; tareas en el mismo tramo de 5 s comparten uno. Más de 6 días: suena a los 6 y esa ronda arma el siguiente |
| Mensaje entrante (`nudgeIfDue`) | Si hay tareas ya vencidas | Red de seguridad |
| Vercel Cron → `GET /api/internal/tasks/run` | Plan **Hobby: una vez al día** (`vercel.json`, 11:00 UTC) | Barrido diario (red de seguridad) |
| Cadena de rondas (`continueIfSoon`) | Solo **sin despertadores** (`TASK_ALARMS=off`): al terminar cada ronda, si algo vence dentro del margen | La ronda se sostiene (`holdWithinMs`) y despierta a la siguiente. Una sola cadena: eslabón con clave única por tramo de 30 s (`scheduling.chain`) |
| Servidor local (`apps/api/main.ts`) / `apps/worker` | Rondas seguidas | Desarrollo y servidor propio |

**El despertador solo suena.** El mensaje de Vercel Queues no lleva trabajo: el consumidor (`api/task-alarm.ts`) llama a `POST /api/internal/tasks/run` del dominio de **producción** con `CRON_SECRET`, y la ronda corre lo vencido en Neon. Vercel entrega cada mensaje al mismo despliegue que lo envió; como ese despliegue solo «toca el timbre», un despertador armado antes de un despliegue nuevo nunca corre código viejo. Si el trabajador no responde, el consumidor lanza y Vercel Queues reintenta cada 30 s durante una hora.

**Plan Hobby, puntualidad y consumo.** Con despertadores, cada espera cuesta un mensaje de la cola y dos invocaciones cortas, sin funciones esperando: el Programador de 3 minutos, el «Tiempo agotado» de 2 horas o una pausa de 2 días llegan a su hora en Hobby. El plan Hobby es solo para uso personal, no comercial: para vender el servicio a clientes hace falta el plan Pro. Si Vercel Queues fallara (`tasks.alarm_failed` en el registro), lo vencido se atiende con el próximo mensaje, la próxima ronda o el barrido diario; con `TASK_ALARMS=off` vuelve la cadena de rondas.

## Configuración

| Variable | Para qué |
|---|---|
| `CRON_SECRET` | **Obligatoria en producción.** Protege `/internal/tasks/run` (Vercel Cron la envía como `Authorization: Bearer …`). Mínimo 16 caracteres. Sin ella el endpoint responde 503 y la cola solo corre dentro del proceso. |
| `TASK_RUNNER_BUDGET_MS` | Duración de una ronda (10 000–290 000; por defecto 50 000). |
| `TASKS_BASE_URL` | Dirección pública de la API para la autoinvocación (por defecto, el dominio de producción de Vercel). |
| `TASK_ALARMS` | Despertadores con Vercel Queues: `on` u `off`. Por defecto `on` en Vercel con `CRON_SECRET`, `off` en local. |
| `TASK_CHAIN_HORIZON_MS` | Margen de la cadena de rondas (por defecto 0 con despertadores y 900 000 = 15 min sin ellos; 0 la apaga). |

## Operación

- Tareas pendientes: `select kind, due_at, attempts from scheduled_tasks where status = 'pending' order by due_at`.
- Fallidas recientes: `select kind, last_error, finished_at from scheduled_tasks where status = 'failed' order by finished_at desc limit 20`.
- Registro de la función: `tasks.round` (lo que hizo cada ronda), `tasks.attempt_failed` (cada intento fallido con su motivo) y `tasks.alarm_failed` (un despertador que no se pudo armar).
- Despertadores: en Vercel → el proyecto → Queues (tema `auream-task-alarms`); el consumidor es la función `api/task-alarm.ts`.
