# Grupos y comunidades — módulo web (`/groups`)

Campañas con un enlace que llena grupos, mis grupos, enviar a muchos grupos y lo que vende cada uno. Diseño: [`docs/architecture/groups.md`](../../../../../docs/architecture/groups.md).

## Estructura
```
features/groups/
├── pages/      GroupsPage: `?tab=mine`, `?campaign=<id>`, `?view=new`, `?edit=<id>`, `?view=send[&to=<campaña>]`
├── overview/   lo vendido este mes, cada campaña y la pantalla de primera vez
├── mine/       Mis grupos: traerlos de WhatsApp y sumarlos a una campaña
├── campaign/   una campaña: enlace con QR, del clic a la venta, grupos, lo automático y los envíos
├── editor/     crear o editar una campaña (la foto se convierte a JPEG 640 para WhatsApp)
├── send/       enviar o programar a grupos (texto, foto, video, audio, encuesta)
├── services/   groupsApi (/groups)
└── groupsFormat.ts
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas. El módulo mide su ancho (container `groups`).
- Contratos: `contracts/GroupContracts.ts`. El QR se dibuja en el navegador (`qrcode`).

## Permisos
Todo el equipo ve (`groups.read`); crear, editar, sincronizar y enviar es de dueños y administradores (`groups.manage`).
