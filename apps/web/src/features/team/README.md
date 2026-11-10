# Equipo — módulo web

**Configuración → Equipo** (`/settings/team`) y la página del enlace de invitación (`/invite/:token`). Arquitectura: [`docs/architecture/team.md`](../../../../../docs/architecture/team.md).

## Qué hay
- **Equipo** (`components/TeamSettings.tsx`): pestañas **Miembros** (`MembersTab`: buscador, filtro por rol, tabla con última vez y menú ⋯ `MemberMenu`; tarjeta «Trabaja en equipo» si estás solo), **Invitaciones** (`InvitationsTab`), **Roles** (`RolesTab`, una tarjeta por rol) y **Actividad** (`ActivityTab`). Qué puede tocar cada uno lo manda el servidor (`assignableRoles`, `canManage`).
- **Invitar** (`InviteDialog`): uno o varios correos como chips (`EmailChipsInput`) con un rol; luego el enlace para copiar o mandar por WhatsApp (`InviteLinkPanel` si es uno, `InviteResults` si son varios). Se muestra una sola vez; «Enlace nuevo» genera otro.
- **La invitación** (`pages/AcceptInvitationPage.tsx`): dentro del marco de acceso de Auream (`shared/ui/auth-layout`). Sin sesión: crear cuenta o entrar, y volver al enlace. Con sesión: «Unirme», que entra a la empresa sin crear un espacio propio vacío (`ActiveTenantProvider` no crea «Mi espacio» en `/invite/…`).

## Estructura
```
features/team/
├── components/   TeamSettings + pestañas (MembersTab, InvitationsTab, RolesTab, ActivityTab), MemberRow, MemberMenu,
│                 InvitationRow, InviteDialog, EmailChipsInput, InviteLinkPanel, InviteResults, TeamDialogs
├── pages/        AcceptInvitationPage
├── hooks/        useTeam (la lista del servidor manda; tras cada acción se vuelve a pedir)
├── services/     teamApi (/team, /team/activity, /invitations/:token, /me/invitations/:token/accept)
└── teamTime.ts   «En línea», «Hace 2 h» y la hora de la actividad
```
- Los nombres y colores de los roles viven en `shared/team/teamRoles.ts` (los usa también el menú de la cuenta).
- La sección la pone la app (`app/settings/SettingsScreen.tsx`): Configuración no importa Equipo, ni Equipo a Cuenta.
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
