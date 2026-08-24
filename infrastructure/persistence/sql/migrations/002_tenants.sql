-- Tenant: la organización cliente. Es la frontera de aislamiento de toda la
-- plataforma; cada entidad de negocio pertenece a un tenant.
--
-- `id` (uuid) es el identificador canónico usado en RequestContext y en toda
-- clave foránea. `key` es el slug legible para URLs y logs — nunca un id.

create table if not exists tenants (
  id         uuid        primary key default gen_random_uuid(),
  key        text        not null,
  name       text        not null,
  status     text        not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_key_unique   unique (key),
  constraint tenants_status_check check (status in ('active', 'suspended'))
);
