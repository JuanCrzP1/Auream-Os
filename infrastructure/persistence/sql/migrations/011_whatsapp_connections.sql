-- Números de WhatsApp conectados a cada cuenta.
--
-- `method`: 'qr' (sesión mantenida por un proveedor externo) o 'cloud_api'
-- (API oficial de Meta). `provider_ref` identifica la sesión o el número en
-- el proveedor; nunca se expone. El teléfono se guarda solo en dígitos (E.164).

create table if not exists whatsapp_connections (
  id                uuid        primary key,
  tenant_id         uuid        not null references tenants (id) on delete cascade,
  name              text        not null,
  method            text        not null,
  status            text        not null default 'pending',
  phone_number      text        null,
  profile_name      text        null,
  provider_ref      text        null,
  last_connected_at timestamptz null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint whatsapp_connections_name_check check (length(btrim(name)) between 1 and 40),
  constraint whatsapp_connections_method_check check (method in ('qr', 'cloud_api')),
  constraint whatsapp_connections_status_check check (status in ('pending', 'connecting', 'connected', 'disconnected')),
  constraint whatsapp_connections_phone_check check (phone_number is null or phone_number ~ '^[0-9]{7,15}$'),
  constraint whatsapp_connections_profile_check check (profile_name is null or length(profile_name) <= 100)
);

create unique index if not exists whatsapp_connections_tenant_name_unique on whatsapp_connections (tenant_id, lower(name));
create index if not exists whatsapp_connections_tenant_idx on whatsapp_connections (tenant_id, created_at);
