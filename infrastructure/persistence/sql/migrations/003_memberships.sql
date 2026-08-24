-- Membership: qué usuario pertenece a qué tenant y con qué rol.
--
-- Es la pieza que convierte una identidad (quién eres, según Neon Auth) en una
-- autorización (qué puedes hacer aquí). Los scopes se derivan del `role` vía
-- ROLE_SCOPES en platform/authorization; nunca viajan en el token.
--
-- `user_id` NO tiene FK hacia neon_auth."user" deliberadamente: ese esquema lo
-- administra Neon y puede migrarlo sin avisarnos; una FK nuestra podría romperse
-- o bloquear sus migraciones. La integridad la garantiza la firma del JWT.
-- Contrapartida aceptada: borrar un usuario en Neon Auth deja memberships
-- huérfanas hasta que se habilite el webhook `user.deleted`.

create table if not exists memberships (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  role       text        not null,
  status     text        not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_user_tenant_unique unique (user_id, tenant_id),
  constraint memberships_role_check check (role in (
    'platform_admin', 'tenant_owner', 'tenant_admin',
    'operator', 'viewer', 'api_client', 'worker'
  )),
  constraint memberships_status_check check (status in ('invited', 'active', 'revoked'))
);

-- "miembros de este tenant"
create index if not exists memberships_tenant_idx on memberships (tenant_id);

-- "mis tenants" tras el login — índice parcial: sólo las activas importan
create index if not exists memberships_user_active_idx
  on memberships (user_id) where status = 'active';
