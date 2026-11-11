# Difusiones — módulo web (`/broadcasts`)

Un flujo o un mensaje a muchos clientes que ya escribieron, con un ritmo que cuida el número y los resultados hasta la venta. Diseño: [`docs/architecture/broadcasts.md`](../../../../../docs/architecture/broadcasts.md).

## Estructura
```
features/broadcasts/
├── pages/      BroadcastsPage: la lista, `?view=new` (nueva) o `?id=` (una difusión)
├── list/       lo vendido este mes, filtros y cada difusión con su resultado
├── wizard/     Nueva difusión en 4 pasos, el alcance en vivo y la vista previa de WhatsApp
├── detail/     avance en vivo, del envío a la venta, versiones, segundo envío y cada persona
├── services/   broadcastsApi (/broadcasts y las etapas del CRM)
└── broadcastFormat.ts   estados, porcentajes, plata y fechas
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas. El módulo mide su ancho (container `broadcasts`).
- Los datos que cruzan con la API se tipan en `contracts/BroadcastContracts.ts` y `BroadcastResultsContracts.ts`.

## Permisos
Todo el equipo ve los resultados (`broadcasts.read`); crear, enviar, pausar, cancelar, probar y las audiencias son de dueños y administradores (`broadcasts.manage`).
