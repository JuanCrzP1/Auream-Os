-- Difusiones: un flujo o un mensaje a muchos clientes que ya escribieron, a un
-- ritmo que cuida cada número.
--
--   broadcasts             la difusión: qué envía (1 a 3 versiones), a quién,
--                          por qué números, cuándo, su ritmo, la prueba A/B y
--                          el segundo envío (otra difusión con `parent_id`)
--   broadcast_recipients   cada cliente con su versión y cómo le fue. Entregado,
--                          leído, respondió y compró NO se copian aquí: se leen
--                          de la bandeja y de Ventas (siempre al día)
--   broadcast_opt_outs     quien pidió no recibir más («SALIR»)
--   broadcast_audiences    audiencias guardadas
--
-- Aditiva: no toca nada existente.

create table if not exists broadcasts (
  id                 uuid        primary key,
  tenant_id          uuid        not null references tenants (id) on delete cascade,
  name               text        not null,
  status             text        not null,
  status_reason      text        null,
  parent_id          uuid        null references broadcasts (id) on delete set null,
  variants           jsonb       not null,
  audience           jsonb       not null,
  connection_ids     uuid[]      not null,
  settings           jsonb       not null,
  ab_test            jsonb       null,
  follow_up          jsonb       null,
  winner             integer     null,
  decides_at         timestamptz null,
  follow_up_due_at   timestamptz null,
  follow_up_child_id uuid        null,
  scheduled_at       timestamptz null,
  started_at         timestamptz null,
  finished_at        timestamptz null,
  created_by         uuid        null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint broadcasts_status_check check (status in ('scheduled', 'sending', 'testing', 'paused', 'auto_paused', 'done', 'cancelled')),
  constraint broadcasts_name_check check (length(btrim(name)) between 1 and 80),
  constraint broadcasts_variants_check check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) between 1 and 3),
  constraint broadcasts_connections_check check (cardinality(connection_ids) >= 1)
);

create index if not exists broadcasts_tenant_created_idx on broadcasts (tenant_id, created_at desc);
-- Un solo segundo envío por difusión.
create unique index if not exists broadcasts_parent_idx on broadcasts (parent_id) where parent_id is not null;

create table if not exists broadcast_recipients (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null references tenants (id) on delete cascade,
  broadcast_id        uuid        not null references broadcasts (id) on delete cascade,
  contact_id          uuid        null references contacts (id) on delete set null,
  name                text        null,
  phone               text        not null,
  connection_id       uuid        not null references whatsapp_connections (id) on delete cascade,
  variant             integer     null,
  position            integer     not null,
  status              text        not null default 'pending',
  provider_message_id text        null,
  error               text        null,
  claimed_at          timestamptz null,
  sent_at             timestamptz null,
  created_at          timestamptz not null default now(),
  constraint broadcast_recipients_status_check check (status in ('pending', 'sending', 'sent', 'failed', 'opted_out', 'cancelled')),
  constraint broadcast_recipients_phone_check check (phone ~ '^[0-9]{7,15}$'),
  -- Un cliente recibe una difusión una sola vez (la lista no se duplica si la tarea se repite).
  constraint broadcast_recipients_unique unique (broadcast_id, phone)
);

-- El siguiente pendiente de un número, en el orden de la lista.
create index if not exists broadcast_recipients_next_idx on broadcast_recipients (broadcast_id, connection_id, position) where status = 'pending';
-- Cuánto envió hoy un número (todas las difusiones) y sus días de calentamiento.
create index if not exists broadcast_recipients_sent_idx on broadcast_recipients (tenant_id, connection_id, sent_at) where status = 'sent';
-- La última difusión que recibió un cliente antes de comprar.
create index if not exists broadcast_recipients_contact_idx on broadcast_recipients (tenant_id, contact_id, sent_at) where status = 'sent';

create table if not exists broadcast_opt_outs (
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  phone      text        not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, phone)
);

create table if not exists broadcast_audiences (
  id         uuid        primary key,
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  name       text        not null,
  audience   jsonb       not null,
  created_at timestamptz not null default now(),
  constraint broadcast_audiences_name_check check (length(btrim(name)) between 1 and 60)
);

create unique index if not exists broadcast_audiences_name_idx on broadcast_audiences (tenant_id, lower(name));
