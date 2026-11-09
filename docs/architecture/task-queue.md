# Cola de tareas y despertadores de los flujos (FASE C6)

`domains/scheduling` · `infrastructure/persistence/sql/SqlTaskRepository.ts` · `019_scheduled_tasks.sql` · `domains/messaging/application/FlowTimerService.ts` · `apps/api/routes/routeInternalTasks.ts`

## Qué resuelve

Un flujo a veces debe seguir **más tarde**: el Programador («espera 3 minutos», «el lunes a las 8»), el «Tiempo agotado» de Esperar respuesta y del Menú, o una pausa de un Mensaje que no cabe en un turno. Vercel no tiene procesos que esperen, así que el motor **no espera**: declara cuándo despertar y una cola en Neon lo despierta a su hora.

## Piezas y responsabilidades

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| Motor (`flow-engine`) | Cada bloque declara su hora (`resumeAt`, `waitDeadlineAt`); el turno devuelve `FlowRunResult.wakeUp`. Al despertar, el bloque recibe `input.timer` y decide (seguir, «Tiempo agotado»). Descarta despertadores viejos. | colas, HTTP, bases |
| `domains/scheduling` | Cola **genérica**: programar (sin duplicados, una pendiente por grupo), reservar de forma atómica, ejecutar con su manejador, reintentar espaciado, dar por fallida, limpiar. | flujos, WhatsApp |
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
                                   │
                           scheduled_tasks (Neon)
                                   │  vence
  Vercel Cron (diario) ──────┐     ▼
  cadena de rondas ──────────┤
  autoinvocación (segundos) ─┼─> /internal/tasks/run ──> TaskRunner ──> FlowTimerTaskHandler
  mensaje entrante (si hay   │                                         └─> FlowTimerService.fire
  vencidas) ─────────────────┘                                              (candado del chat) ──> FlowTurn
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
| Autoinvocación (`HttpTaskKicker`) | Al programar algo que vence dentro del margen de la cadena (15 min) | Arranca la ronda enseguida |
| **Cadena de rondas** (`continueIfSoon`) | Al terminar cada ronda, si algo vence dentro del margen | Programador y esperas de minutos con el plan Hobby: la ronda se sostiene (`holdWithinMs`) y despierta a la siguiente. Una sola cadena: eslabón con clave única por tramo de 30 s (`scheduling.chain`). Se detiene sola cuando no queda nada cercano |
| Mensaje entrante (`nudgeIfDue`) | Si hay tareas ya vencidas | Red de seguridad: esperas largas (horas) que vencieron fuera del margen |
| Vercel Cron → `GET /api/internal/tasks/run` | Plan **Hobby: una vez al día** (`vercel.json`, 11:00 UTC). Plan Pro: puede ser cada minuto | Barrido diario. Con Pro y cron cada minuto, la cadena se apaga (`TASK_CHAIN_HORIZON_MS=0`) |
| Servidor local (`apps/api/main.ts`) / `apps/worker` | Rondas seguidas | Desarrollo y servidor propio |

**Plan Hobby, puntualidad y consumo.** Lo que vence dentro de 15 minutos (pausas, Programador de minutos, esperas cortas) llega a su hora gracias a la cadena. Lo que vence más tarde (esperas de horas) llega en cuanto entre cualquier mensaje a un número de la cuenta, o con el barrido diario. Mientras la cadena corre, la función de Vercel se mantiene activa y gasta tiempo del plan: con tráfico constante todo el día, Hobby puede quedarse corto. Para puntualidad garantizada y más volumen, conviene el plan Pro con cron cada minuto y la cadena apagada.

## Configuración

| Variable | Para qué |
|---|---|
| `CRON_SECRET` | **Obligatoria en producción.** Protege `/internal/tasks/run` (Vercel Cron la envía como `Authorization: Bearer …`). Mínimo 16 caracteres. Sin ella el endpoint responde 503 y la cola solo corre dentro del proceso. |
| `TASK_RUNNER_BUDGET_MS` | Duración de una ronda (10 000–290 000; por defecto 50 000). |
| `TASKS_BASE_URL` | Dirección pública de la API para la autoinvocación (por defecto, el dominio de producción de Vercel). |
| `TASK_CHAIN_HORIZON_MS` | Margen de la cadena de rondas (por defecto 900 000 = 15 min; 0 la apaga). |

## Operación

- Tareas pendientes: `select kind, due_at, attempts from scheduled_tasks where status = 'pending' order by due_at`.
- Fallidas recientes: `select kind, last_error, finished_at from scheduled_tasks where status = 'failed' order by finished_at desc limit 20`.
- Registro de la función: `tasks.round` (lo que hizo cada ronda) y `tasks.attempt_failed` (cada intento fallido con su motivo).
