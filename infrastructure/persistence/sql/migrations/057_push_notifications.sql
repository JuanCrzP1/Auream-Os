-- Avisos en el celular o el computador (Web Push). Aditiva.
--
--   push_subscriptions        cada dispositivo donde una persona activó los
--                             avisos. Es de la PERSONA (le suena de todas sus
--                             empresas); el `endpoint` es único en el mundo.
--   notification_preferences  qué le suena a cada persona en cada empresa.
--                             Solo se guarda lo que la persona cambió: sin fila,
--                             el aviso está prendido.

create table if not exists push_subscriptions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null,
  endpoint      text        not null,
  p256dh        text        not null,
  auth          text        not null,
  label         text        not null default '',
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz null,
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_check check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  constraint push_subscriptions_keys_check check (length(p256dh) between 20 and 200 and length(auth) between 8 and 100),
  constraint push_subscriptions_label_check check (length(label) <= 60)
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

create table if not exists notification_preferences (
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  user_id     uuid        not null,
  topic       text        not null,
  enabled     boolean     not null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, user_id, topic),
  constraint notification_preferences_topic_check check (topic in ('chat_message', 'number_disconnected', 'sale_review', 'follow_up_due'))
);
