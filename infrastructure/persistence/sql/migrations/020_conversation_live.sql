-- La bandeja en vivo (como WhatsApp):
--
--   · estado de cada mensaje enviado: enviado (un chulo), entregado (dos
--     chulos grises) y leído (dos chulos azules), con los avisos del
--     proveedor (`messages_update` de uazapi) por el id de WhatsApp
--     (`provider_message_id`) que ahora también guardan los mensajes salientes
--   · `updated_at`: la pantalla pide solo lo nuevo o lo que cambió desde la
--     última vez, en lugar del hilo completo cada pocos segundos

alter table conversation_messages add column if not exists updated_at timestamptz not null default now();

alter table conversation_messages drop constraint if exists conversation_messages_status_check;
alter table conversation_messages add constraint conversation_messages_status_check
  check (status in ('received', 'sent', 'delivered', 'read', 'failed'));

-- «lo que cambió desde…» de un chat
create index if not exists conversation_messages_live_idx on conversation_messages (conversation_id, updated_at);

-- avisos de entregado/leído: por el id de WhatsApp de lo que salió
create index if not exists conversation_messages_provider_idx
  on conversation_messages (provider_message_id)
  where direction = 'outbound' and provider_message_id is not null;
