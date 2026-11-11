# broadcasts — difusiones (bounded context)

Opción de la barra: **Difusiones** (`/broadcasts`). Web: `apps/web/src/features/broadcasts/`. Diseño completo: [`docs/architecture/broadcasts.md`](../../docs/architecture/broadcasts.md).

## Responsabilidad
Escribirle primero a muchos clientes que **ya escribieron**: un flujo o un mensaje, por los números elegidos, ahora o programado, a un ritmo que cuida cada número, y medir del envío a la venta.

## Le pertenece
- La difusión: versiones (1 a 3), audiencia, números, hora, ritmo, prueba A/B, segundo envío y estado (`domain/Broadcast.ts`, `BroadcastDraft.ts`).
- El ritmo: pausas al azar, horario, tope diario y calentamiento (`domain/Pace.ts`).
- El nombre de cada persona y el «SALIR» (`domain/Personalize.ts`); las versiones y quién gana la prueba (`domain/Variants.ts`).
- Los destinatarios, las bajas («no quiero más») y las audiencias guardadas.

## No le pertenece
- Enviar y que quede en el chat: `domains/messaging` (`OutreachService`).
- Programar en el tiempo: `domains/scheduling` (la cola de tareas).
- Quiénes son los contactos y sus etiquetas: `domains/contacts`; las ventas: `domains/sales` (solo se leen).

## Capas
- `domain/`: reglas puras.
- `application/`: `BroadcastServices` (pantalla), `AudienceServices` (alcance y audiencias), `BroadcastLauncher` (arrancar, decidir la prueba, segundo envío), `BroadcastDispatcher` (cada envío), `OptOutListener` («SALIR»). Puertos en `BroadcastPorts.ts`.
- Persistencia: `infrastructure/persistence/sql/SqlBroadcast*.ts` (`034_broadcasts.sql`).
- Composición: `apps/api/composition/composeBroadcastServices.ts` y `broadcastTaskAdapters.ts`.
