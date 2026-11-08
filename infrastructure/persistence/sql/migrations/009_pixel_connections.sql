-- Píxeles de Meta conectados a cada cuenta (API de Conversiones).
--
-- El token NUNCA se guarda en claro: `secret` es un sobre AES-256-GCM atado a
-- esta cuenta y esta conexión. `token_hint` son sus últimos caracteres, lo
-- único que se muestra. El ID del píxel no es secreto.

create table if not exists pixel_connections (
  id               uuid        primary key,
  tenant_id        uuid        not null references tenants (id) on delete cascade,
  name             text        not null,
  pixel_id         text        not null,
  secret           text        not null,
  token_hint       text        not null,
  status           text        not null default 'active',
  last_verified_at timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint pixel_connections_name_check check (length(btrim(name)) between 1 and 60),
  constraint pixel_connections_pixel_id_check check (pixel_id ~ '^[0-9]{8,20}$'),
  constraint pixel_connections_status_check check (status in ('active', 'invalid')),
  constraint pixel_connections_secret_check check (secret ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$'),
  constraint pixel_connections_hint_check check (length(token_hint) <= 12)
);

create unique index if not exists pixel_connections_tenant_name_unique on pixel_connections (tenant_id, lower(name));
create index if not exists pixel_connections_tenant_idx on pixel_connections (tenant_id, created_at);
