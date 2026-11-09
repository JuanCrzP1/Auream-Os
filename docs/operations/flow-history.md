# Historial interno de los flujos

Para revisar **nosotros** qué pasó en un chat cuando algo se traba. No es una pantalla de la aplicación.

## Qué se anota

Cada turno de un flujo (`FlowTurn`), venga de un mensaje del cliente, de un despertador (intervalo, tiempo agotado, pausa larga) o de un envío a mano:

- qué lo inició (`message`, `timer` con su motivo y bloque, `manual`)
- por qué bloques pasó, en orden, con su resultado y la salida que tomó
- cuántos mensajes salieron y qué falló (con el motivo)
- dónde quedó la sesión y qué espera quedó programada (y para cuándo, ya corrida por lo que tardó la entrega)
- si el turno reventó, el motivo

| Dónde | Cuánto dura | Para qué |
|---|---|---|
| Neon, tabla `flow_turn_log` (`023_flow_turn_log.sql`) | 14 días | El historial completo de un chat |
| Registro de Vercel, línea `flow.turn` (sin el texto del cliente) | 1 hora en Hobby | Ver una prueba en vivo sin leer la base |

Anotar nunca rompe el turno: si Neon falla, queda la línea del registro y el aviso `flow.turn_log_failed`.

## Cómo leerlo

```bash
# rama test
node scripts/ops/flow-history.mjs 2233
# producción (solo lectura; exige el destino explícito)
DATABASE_URL="$(npx neonctl connection-string production --project-id <proyecto>)" \
  node scripts/ops/flow-history.mjs 2233 --confirm-production
```

Muestra la línea de tiempo del chat cuyo teléfono termina en esos dígitos y, al final, su cola de tareas (cuándo vencía cada despertador y cuánto después corrió).

En vivo: `vercel logs --environment production --query 'flow.turn'` (y `tasks.alarm_rang`, `tasks.round`, `tasks.late` para la puntualidad: ver `docs/architecture/task-queue.md`).
