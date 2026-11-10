# team — el equipo de cada cuenta (bounded context)

Opción: **Configuración → Equipo** (`/settings?tab=team`; «Equipo» del menú de la cuenta lleva ahí). Web: `apps/web/src/features/team/`. Arquitectura y decisiones: [`docs/architecture/team.md`](../../docs/architecture/team.md).

## Qué le pertenece
- **Quién está en qué cuenta y con qué rol**: las membresías (`memberships`) vistas como equipo.
- **Las invitaciones por enlace** (`team_invitations`): crear, renovar, retirar y aceptar.
- **Las reglas de quién puede tocar a quién** (`domain/TeamPolicy.ts`): el dueño toca a todos y nombra dueños; el administrador toca a todos menos a los dueños; nadie se toca a sí mismo; siempre queda un dueño.
- El alta inicial (`OnboardingPort`: la primera cuenta de quien se registra).

## Qué NO le pertenece
- **Qué significa cada rol** (sus permisos): `platform/authorization` (`ROLE_SCOPES`, `TeamPermissions`). Aquí se decide A QUIÉN se le da cuál.
- **Las credenciales**: Neon Auth. Aquí solo se lee el correo y el nombre que firma su token, como datos de la persona.
- **Lo que se muestra de cada persona** (nombre, foto): `domains/profiles` (`user_profiles`). El equipo lo lee en la consulta SQL, sin importar ese dominio.

## Capas
```
domains/team/
├── contracts/Membership.ts          la pertenencia (usuario → cuenta → rol)
├── domain/
│   ├── TeamPolicy.ts                quién puede invitar, cambiar o quitar a quién (funciones puras)
│   └── Invitation.ts                la invitación: correo, rol, vencimiento (7 días), estados
└── application/
    ├── TeamServices.ts              el lado de quien administra: ver, invitar, renovar, retirar, cambiar rol, quitar
    ├── InvitationServices.ts        el lado de quien recibe: abrir el enlace (sin sesión) y aceptar (con sesión)
    ├── InvitationToken.ts           el secreto del enlace (32 bytes) y su huella SHA-256
    ├── TeamRepository.ts            puerto: miembros (cambiar rol y quitar sin dejar la cuenta sin dueño)
    ├── InvitationRepository.ts      puerto: invitaciones (aceptar es atómico)
    ├── MembershipRepository.ts      puerto: membresía activa (cada petición) y «mis cuentas»
    └── OnboardingPort.ts            puerto: la primera cuenta
```
Implementaciones: `infrastructure/persistence/sql/Sql{Team,Invitation,Membership,Onboarding}Repository.ts` y en memoria `InMemoryTeamRepositories.ts`. Composición: `apps/api/composition/composeTeamServices.ts`.

## Depende de
- `contracts/TeamContracts.ts` (lo que cruza HTTP) y `platform/authorization` (roles y errores). Ningún otro dominio.
