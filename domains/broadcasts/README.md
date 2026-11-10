# broadcasts — difusiones (bounded context)

Opción de la barra: **Difusiones** (`/broadcasts`). Web: `apps/web/src/features/broadcasts/`.

## Responsabilidad
Enviar **un flujo** a muchos contactos a la vez, como Leona: elegir la audiencia (etiquetas o etapa del CRM), programar cuándo, salir a un **ritmo** que cuida el número (lotes y pausas) y medir el resultado de cada destinatario.

## Le pertenece
- La difusión: audiencia, flujo a enviar, número que envía, hora, ritmo y estado.
- Los destinatarios con su estado (pendiente, enviado, falló, respondió).
- El cupo por plan cuando lleguen los planes (`domains/billing`).

## No le pertenece
- Ejecutar el flujo: `domains/messaging` (el mismo «turno de flujo» de siempre).
- Programar en el tiempo: `domains/scheduling` (la cola de tareas en Neon).
- Quiénes son los contactos: `domains/contacts`.

## Depende de (por puertos)
`contacts` (resolver la audiencia), `messaging` (iniciar el flujo a cada uno), `scheduling` (lotes y pausas), `connections` (el número que envía).

## Capas
`domain/` (Broadcast, Audience, Recipient, Pace) · `application/` · persistencia SQL. API prevista: `/broadcasts`.
