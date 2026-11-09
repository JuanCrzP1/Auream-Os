-- Webhooks de entrada (como en Leona): una dirección secreta por webhook que
-- recibe datos de otros sistemas y, con su mapeo, identifica al cliente, guarda
-- sus datos, pone o quita etiquetas e inicia un flujo. El secreto se guarda
-- cifrado. El historial de envíos se guarda 30 días. Aditiva.

create table if not exists inbound_webhooks (
  id                 uuid        primary key,
  tenant_id          uuid        not null references tenants (id) on delete cascade,
  name               text        not null,
  enabled            boolean     not null default true,
  connection_id      uuid        null,
  secret_envelope    text        not null,
  mapping            jsonb       not null default '{}',
  sample             jsonb       null,
  sample_received_at timestamptz null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint inbound_webhooks_name_check check (length(btrim(name)) between 1 and 60),
  constraint inbound_webhooks_mapping_check check (jsonb_typeof(mapping) = 'object')
);

create index if not exists inbound_webhooks_tenant_idx on inbound_webhooks (tenant_id, created_at);

create table if not exists inbound_webhook_deliveries (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants (id) on delete cascade,
  webhook_id   uuid        not null references inbound_webhooks (id) on delete cascade,
  received_at  timestamptz not null,
  outcome      text        not null,
  phone        text        null,
  contact_id   uuid        null,
  flow_started boolean     not null default false,
  notes        jsonb       not null default '[]',
  error        text        null,
  payload      jsonb       null,
  constraint inbound_webhook_deliveries_outcome_check check (outcome in ('processed', 'sample', 'ignored', 'failed'))
);

-- historial de un webhook y uso del mes
create index if not exists inbound_webhook_deliveries_webhook_idx on inbound_webhook_deliveries (webhook_id, received_at desc);
create index if not exists inbound_webhook_deliveries_tenant_idx on inbound_webhook_deliveries (tenant_id, received_at);
