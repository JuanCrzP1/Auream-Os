-- Mensajes que los clientes escribieron a los números de la cuenta.
--
-- Sirve para dos cosas: no procesar dos veces el mismo mensaje (el proveedor
-- puede repetir avisos; único por conexión + id del mensaje) y dejar rastro
-- de qué pasó con cada uno (flujo que inició o continuó, cuántas respuestas
-- se enviaron, error). Del texto solo se guarda un adelanto.

create table if not exists inbound_messages (
  id                  bigint      generated always as identity primary key,
  tenant_id           uuid        not null references tenants (id) on delete cascade,
  connection_id       uuid        not null references whatsapp_connections (id) on delete cascade,
  provider_message_id text        not null,
  phone               text        not null,
  kind                text        not null,
  provider_type       text        not null,
  text_preview        text        not null default '',
  outcome             text        null,
  flow_key            text        null,
  sent_count          integer     null,
  error               text        null,
  events              text[]      not null default '{}',
  received_at         timestamptz not null default now(),
  processed_at        timestamptz null,
  constraint inbound_messages_outcome_check check (outcome is null or outcome in ('flow_started', 'flow_continued', 'no_trigger', 'ignored', 'failed')),
  constraint inbound_messages_unique unique (connection_id, provider_message_id)
);

create index if not exists inbound_messages_tenant_idx on inbound_messages (tenant_id, received_at desc);
