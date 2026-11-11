-- Herramientas del chat (Conversaciones, fase 1).
--
--   quick_replies                     respuestas rápidas de la cuenta: un atajo
--                                     («saludo») y sus piezas en orden (texto,
--                                     foto, video, audio, documento)
--   conversation_messages.reply_to_id el mensaje que cita una respuesta, o al
--                                     que apunta una reacción del asesor
--
-- Aditiva: no toca nada existente.

create table if not exists quick_replies (
  id            uuid        primary key,
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  shortcut      text        not null,
  pieces        jsonb       not null,
  use_count     integer     not null default 0,
  last_used_at  timestamptz null,
  created_by    text        null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint quick_replies_shortcut_check check (shortcut ~ '^[a-z0-9_-][a-z0-9 _-]{0,39}$'),
  constraint quick_replies_pieces_check check (jsonb_typeof(pieces) = 'array'),
  constraint quick_replies_unique unique (tenant_id, shortcut)
);

create index if not exists quick_replies_recent_idx on quick_replies (tenant_id, last_used_at desc nulls last);

alter table conversation_messages add column if not exists reply_to_id uuid null;
