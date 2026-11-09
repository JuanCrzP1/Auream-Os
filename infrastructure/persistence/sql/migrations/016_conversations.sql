-- La bandeja: un chat por cliente y por número de la cuenta, con todos sus
-- mensajes (del cliente, del bot y de los asesores).
--
-- `bot_enabled = false` pausa el bot en ese chat: los mensajes se guardan pero
-- no inician ni continúan flujos (un asesor atiende). Los contadores y el
-- último mensaje viven en la conversación para listar la bandeja sin recorrer
-- todos los mensajes.

create table if not exists conversations (
  id                   uuid        primary key,
  tenant_id            uuid        not null references tenants (id) on delete cascade,
  connection_id        uuid        not null references whatsapp_connections (id) on delete cascade,
  contact_id           uuid        null references contacts (id) on delete set null,
  phone                text        not null,
  bot_enabled          boolean     not null default true,
  unread_count         integer     not null default 0,
  last_message_text    text        not null default '',
  last_message_author  text        null,
  last_message_at      timestamptz null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint conversations_phone_check check (phone ~ '^[0-9]{7,15}$'),
  constraint conversations_author_check check (last_message_author is null or last_message_author in ('contact', 'bot', 'agent')),
  constraint conversations_unique unique (connection_id, phone)
);

create index if not exists conversations_inbox_idx on conversations (tenant_id, last_message_at desc nulls last);

create table if not exists conversation_messages (
  id                  uuid        primary key,
  tenant_id           uuid        not null references tenants (id) on delete cascade,
  conversation_id     uuid        not null references conversations (id) on delete cascade,
  direction           text        not null,
  author              text        not null,
  kind                text        not null,
  text                text        not null default '',
  media_url           text        null,
  media_type          text        null,
  options             text[]      not null default '{}',
  status              text        not null,
  error               text        null,
  flow_key            text        null,
  agent_id            text        null,
  agent_name          text        null,
  provider_message_id text        null,
  created_at          timestamptz not null default now(),
  constraint conversation_messages_direction_check check (direction in ('inbound', 'outbound')),
  constraint conversation_messages_author_check check (author in ('contact', 'bot', 'agent')),
  constraint conversation_messages_status_check check (status in ('received', 'sent', 'failed'))
);

create index if not exists conversation_messages_thread_idx on conversation_messages (conversation_id, created_at desc);

-- Mensajes que el bot no procesó porque un asesor atiende el chat.
alter table inbound_messages drop constraint if exists inbound_messages_outcome_check;
alter table inbound_messages add constraint inbound_messages_outcome_check
  check (outcome is null or outcome in ('flow_started', 'flow_continued', 'no_trigger', 'bot_paused', 'ignored', 'failed'));
