-- Mensajes programados de un chat: lo que un asesor deja listo para que salga
-- solo a una hora (un recordatorio de pago mañana a las 9, un seguimiento).
-- La cola de tareas (`scheduled_tasks`) solo despierta a la hora; aquí vive
-- el mensaje, quién lo programó y cómo terminó.
--
--   parts              las piezas en orden (textos y archivos con leyenda), igual
--                      que una respuesta del asesor
--   send_at            cuándo sale (instante; la web lo elige en la hora del negocio)
--   cancel_if_replied  no sale si el cliente escribe después de `armed_at`
--   armed_at           cuándo se programó o se editó por última vez
--   status             pending → sending → sent | failed | skipped (el cliente
--                      respondió antes); pending | failed | skipped → cancelled
--   claimed_at         cuándo empezó a enviarse (un envío que se quedó a medias
--                      se marca fallido: nunca se reenvía solo, para no duplicar)
--
-- Si se elimina el chat, se van sus programados. Aditiva: no toca nada existente.

create table if not exists scheduled_messages (
  id                 uuid        primary key,
  tenant_id          uuid        not null references tenants (id) on delete cascade,
  conversation_id    uuid        not null references conversations (id) on delete cascade,
  parts              jsonb       not null,
  send_at            timestamptz not null,
  cancel_if_replied  boolean     not null default true,
  status             text        not null default 'pending',
  error              text        null,
  author_id          uuid        null,
  armed_at           timestamptz not null default now(),
  claimed_at         timestamptz null,
  finished_at        timestamptz null,
  created_at         timestamptz not null default now(),
  constraint scheduled_messages_parts_check check (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) between 1 and 10),
  constraint scheduled_messages_status_check check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled'))
);

-- Lo que se ve en el chat (y en la bandeja: el próximo y si alguno falló).
create index if not exists scheduled_messages_open_idx
  on scheduled_messages (tenant_id, conversation_id, send_at)
  where status in ('pending', 'sending', 'failed', 'skipped');
