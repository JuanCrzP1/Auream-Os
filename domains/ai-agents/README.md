# ai-agents — agentes de IA (bounded context)

Opción de la barra: **Agentes de IA** (`/ai-agents`). Web: `apps/web/src/features/ai-agents/`.

## Responsabilidad
La parte de la plataforma de los agentes: activarlos por cuenta, su configuración (qué productos ofrecen, tono, cuándo pasan a un flujo o a un asesor) y su uso. Como en Leona, un agente atiende en WhatsApp, saca dudas y dispara el flujo.

## No le pertenece
La inteligencia de venta: el motor `ai-sales-engine` (FASE E), que se incorpora completo detrás de un puerto. Ver `docs/architecture/ai-agents.md` y `docs/architecture/ai-sales-engine.md`.

## Capas
Se crean en la FASE E (E2–E4): puerto en `application/`, adaptador hacia el motor, persistencia de activación y configuración.
