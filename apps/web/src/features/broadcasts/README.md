# Difusiones — módulo web (`/broadcasts`)

Enviar un flujo a muchos contactos a la vez, elegidos por etiquetas o etapa del CRM, programado y con un ritmo que cuida el número, con los resultados de cada destinatario.

**Hoy:** `pages/BroadcastsPage.tsx` cuenta lo que traerá.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/broadcasts/
├── pages/        BroadcastsPage (lista) y el detalle de una difusión
├── components/   asistente (audiencia → flujo → hora y ritmo), progreso y resultados
├── hooks/        estado del asistente y avance en vivo
└── services/     broadcastsApi (/broadcasts)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- API `/broadcasts` → dominio `domains/broadcasts` (usa la cola de tareas y el turno de flujo de siempre).

Mapa de todos los módulos: `docs/architecture/modules.md`.
