# Equipo — módulo web

**Configuración → Equipo** (`/settings?tab=team`) y la página del enlace de invitación (`/invite/:token`). Arquitectura: [`docs/architecture/team.md`](../../../../../docs/architecture/team.md).

## Qué hay
- **Equipo** (`components/TeamSettings.tsx`): tarjetas de resumen (miembros, invitaciones pendientes, tu rol), la lista de miembros con su rol, las invitaciones pendientes y «¿Qué puede hacer cada rol?». Quien administra el equipo invita, cambia roles en la misma fila y quita; el resto lo ve. Qué puede tocar cada uno lo manda el servidor (`assignableRoles`, `canManage`).
- **Invitar** (`InviteDialog` → `InviteLinkPanel`): correo y rol en tarjetas; luego el enlace para copiar o mandar por WhatsApp. Se muestra una sola vez; «Enlace nuevo» genera otro.
- **La invitación** (`pages/AcceptInvitationPage.tsx`): dentro del marco de acceso de Auream (`shared/ui/auth-layout`). Sin sesión: crear cuenta o entrar, y volver al enlace. Con sesión: «Unirme», que entra a la empresa sin crear un espacio propio vacío (`ActiveTenantProvider` no crea «Mi espacio» en `/invite/…`).

## Estructura
```
features/team/
├── components/   TeamSettings, MemberRow, InvitationRow, InviteDialog, InviteLinkPanel, RolesGuide, TeamDialogs
├── pages/        AcceptInvitationPage
├── hooks/        useTeam (la lista del servidor manda; tras cada acción se vuelve a pedir)
└── services/     teamApi (/team, /invitations/:token, /me/invitations/:token/accept)
```
- Los nombres y colores de los roles viven en `shared/team/teamRoles.ts` (los usa también el menú de la cuenta).
- La pestaña la suma la app (`app/router/accountRoutes.tsx`): Configuración (módulo Cuenta) no importa Equipo.
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
