# Grupos y comunidades — módulo web (`/groups`)

Los grupos y comunidades de WhatsApp de cada número: mensajes programados, bienvenida automática a quien entra y enlaces de invitación.

**Hoy:** `pages/GroupsPage.tsx` cuenta lo que traerá.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/groups/
├── pages/        GroupsPage (grupos por número) y el detalle de un grupo
├── components/   lista de grupos, programador de mensajes, regla de bienvenida
├── hooks/        carga y sincronización de grupos
└── services/     groupsApi (/groups)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- API `/groups` → dominio `domains/groups` → proveedor de WhatsApp (`infrastructure/whatsapp`).

Mapa de todos los módulos: `docs/architecture/modules.md`.
