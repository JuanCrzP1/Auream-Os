# crm — etapas de venta y seguimientos (bounded context)

Opción de la barra: **CRM** (`/crm`). Web: `apps/web/src/features/crm/`.

## Responsabilidad
El proceso de venta de cada cliente: en qué **etapa** está (Nuevo, Interesado, Pagó…), cuánto **vale** la oportunidad, quién la **atiende**, qué **seguimiento** toca y cuándo, y el historial de cambios de etapa.

## Le pertenece
- Embudos (pipelines) con sus etapas, por cuenta.
- Oportunidades: contacto + etapa + valor + responsable + fechas.
- Seguimientos: tareas con fecha y responsable (avisan a su hora con `scheduling`).

## No le pertenece
- Los datos de la persona, sus etiquetas y campos: `domains/contacts` (el CRM la referencia por id).
- Los chats: `domains/conversations`. Las ventas cobradas: `domains/sales`.

## Depende de (por puertos, nunca importando otros dominios)
- `contacts` (que la persona exista), `scheduling` (avisos de seguimiento).
- Los flujos mueven etapas con el bloque Etiquetas (una etapa puede ser una etiqueta): sin bloque nuevo.

## Capas (se crean con contenido real)
`domain/` (Pipeline, Stage, Deal, FollowUp) · `application/` (casos de uso y puertos) · persistencia en `infrastructure/persistence/sql`. API prevista: `/crm/pipelines`, `/crm/deals`, `/crm/follow-ups`.
