-- Disparadores de cada conexión de WhatsApp: qué flujo arranca cuando un
-- cliente escribe a ese número (palabra clave, anuncio, primer mensaje o
-- cualquier mensaje). Se borran con su conexión o con su flujo.

create table if not exists connection_triggers (
  id            uuid        primary key,
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  connection_id uuid        not null references whatsapp_connections (id) on delete cascade,
  automation_id uuid        not null references automations (id) on delete cascade,
  type          text        not null,
  keywords      text[]      not null default '{}',
  match         text        not null default 'contains',
  enabled       boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint connection_triggers_type_check check (type in ('keyword', 'ad_click', 'first_message', 'any_message')),
  constraint connection_triggers_match_check check (match in ('contains', 'exact', 'starts_with')),
  constraint connection_triggers_keywords_check check (
    (type = 'keyword' and cardinality(keywords) between 1 and 20) or (type <> 'keyword' and cardinality(keywords) = 0)
  )
);

create index if not exists connection_triggers_connection_idx on connection_triggers (tenant_id, connection_id, created_at);
-- Un solo «anuncio», «primer mensaje» y «cualquier mensaje» por número.
create unique index if not exists connection_triggers_generic_unique on connection_triggers (connection_id, type) where type <> 'keyword';
