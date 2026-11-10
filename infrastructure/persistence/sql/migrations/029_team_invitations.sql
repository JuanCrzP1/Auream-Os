-- Equipo (F4): invitaciones por enlace y el correo de cada miembro.
--
-- `team_invitations`: una invitación a la cuenta para un correo, con su rol.
-- El secreto del enlace (`/invite/<token>`) se guarda SOLO como huella
-- SHA-256; vence a los 7 días y sirve una vez. Una sola pendiente por correo y
-- cuenta (invitar de nuevo la renueva). Aceptar crea o reactiva la membresía.
-- Sin FK hacia neon_auth."user" (`invited_by`, `accepted_by`) por la misma
-- razón que `memberships`: ese esquema lo administra Neon.
--
-- `user_profiles.email`: copia del correo de acceso que firma Neon Auth en el
-- token, guardada al entrar a la app. Sirve para mostrar a cada miembro y
-- para no invitar a quien ya está. Neon Auth sigue siendo la autoridad de
-- credenciales: esta copia nunca autentica a nadie.
--
-- Aditiva: la versión que sirve sigue igual.

alter table user_profiles add column if not exists email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_email_check') then
    alter table user_profiles add constraint user_profiles_email_check
      check (email is null or (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1));
  end if;
end $$;

-- «¿ya está en el equipo?» busca por correo.
create index if not exists user_profiles_email_idx on user_profiles (email) where email is not null;

create table if not exists team_invitations (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  email       text        not null,
  role        text        not null,
  token_hash  text        not null,
  status      text        not null default 'pending',
  invited_by  uuid        not null,
  accepted_by uuid,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  updated_at  timestamptz not null default now(),
  constraint team_invitations_email_check  check (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1),
  constraint team_invitations_role_check   check (role in ('tenant_owner', 'tenant_admin', 'operator', 'viewer')),
  constraint team_invitations_status_check check (status in ('pending', 'accepted', 'revoked')),
  constraint team_invitations_token_check  check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint team_invitations_accepted_check check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null))
);

-- El enlace se busca por su huella.
create unique index if not exists team_invitations_token_unique on team_invitations (token_hash);

-- Una sola invitación pendiente por correo y cuenta.
create unique index if not exists team_invitations_pending_email_unique
  on team_invitations (tenant_id, email) where status = 'pending';

-- «invitaciones de esta cuenta», las más nuevas primero.
create index if not exists team_invitations_tenant_idx on team_invitations (tenant_id, created_at desc);
