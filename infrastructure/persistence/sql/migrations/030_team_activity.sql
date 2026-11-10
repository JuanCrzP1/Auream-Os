-- Equipo: «última vez» de cada miembro y registro de actividad.
--
-- `memberships.last_seen_at`: la última vez que la persona usó la app en esa
-- cuenta («En línea», «Hace 2 horas»). Se anota como mucho una vez por minuto.
--
-- `team_activity`: quién invitó, renovó o retiró una invitación, quién entró,
-- quién cambió un rol o quitó a alguien, y cuándo. Solo hechos del equipo: sin
-- datos de conversaciones. Sin FK hacia neon_auth."user", como `memberships`.
--
-- Aditiva: la versión que sirve sigue igual.

alter table memberships add column if not exists last_seen_at timestamptz;

create table if not exists team_activity (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null references tenants (id) on delete cascade,
  actor_id       uuid        not null,
  action         text        not null,
  target_user_id uuid,
  target_email   text,
  role           text,
  created_at     timestamptz not null default now(),
  constraint team_activity_action_check check (action in ('invited', 'invitation_renewed', 'invitation_revoked', 'joined', 'role_changed', 'removed')),
  constraint team_activity_role_check check (role is null or role in ('tenant_owner', 'tenant_admin', 'operator', 'viewer'))
);

-- «actividad de esta cuenta», la más reciente primero.
create index if not exists team_activity_tenant_idx on team_activity (tenant_id, created_at desc);
