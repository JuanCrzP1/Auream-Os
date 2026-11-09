-- Sesiones de ejecución: en qué bloque de qué flujo va cada conversación y lo
-- que el flujo guardó (respuestas, datos de integraciones…). Una fila por
-- conversación (`id` = `<tenant>:<conversación>`): cuando un flujo termina y
-- el cliente vuelve a escribir, la fila se reemplaza por la nueva sesión.

create table if not exists flow_sessions (
  id               text        primary key,
  tenant_id        uuid        not null references tenants (id) on delete cascade,
  flow_id          text        not null,
  flow_version_id  text        not null,
  channel          text        not null,
  conversation_key text        not null,
  user_key         text        not null,
  current_node_id  text        not null,
  status           text        not null,
  revision         integer     not null,
  context          jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null,
  updated_at       timestamptz not null,
  constraint flow_sessions_status_check check (status in ('active', 'waiting_input', 'paused', 'delayed', 'completed', 'failed')),
  constraint flow_sessions_id_check check (id = tenant_id::text || ':' || conversation_key)
);

create index if not exists flow_sessions_tenant_idx on flow_sessions (tenant_id, updated_at desc);
