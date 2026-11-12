-- La atención de cada chat (Conversaciones, fase 2) y las notas internas.
--
--   conversations.status          con bot · en espera · en atención · resuelto
--   conversations.assignee_id     el asesor responsable (null: sin asignar)
--   conversations.awaiting_since  desde cuándo el cliente espera respuesta
--                                 (su primer mensaje sin contestar); null: nadie
--                                 le debe nada
--   conversations.resolved_at     cuándo se resolvió por última vez
--   contact_notes                 notas del equipo sobre un cliente (no las ve él)
--
-- Los chats que ya existen quedan «con bot» si el bot los atiende y «en
-- espera» si estaba pausado. Aditiva: no borra nada.

alter table conversations add column if not exists status text not null default 'bot';
alter table conversations add column if not exists assignee_id uuid null;
alter table conversations add column if not exists awaiting_since timestamptz null;
alter table conversations add column if not exists resolved_at timestamptz null;

alter table conversations drop constraint if exists conversations_status_check;
alter table conversations add constraint conversations_status_check check (status in ('bot', 'waiting', 'attending', 'resolved'));

update conversations set status = 'waiting' where bot_enabled = false and status = 'bot';
update conversations set awaiting_since = last_message_at where last_message_author = 'contact' and awaiting_since is null;

-- Pestañas de la bandeja (por estado) y «Mis chats».
create index if not exists conversations_status_idx on conversations (tenant_id, status, last_message_at desc nulls last);
create index if not exists conversations_assignee_idx on conversations (tenant_id, assignee_id) where assignee_id is not null;

create table if not exists contact_notes (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  contact_id  uuid        not null,
  body        text        not null,
  author_id   uuid        null,
  author_name text        null,
  created_at  timestamptz not null default now(),
  constraint contact_notes_contact_fk foreign key (tenant_id, contact_id) references contacts (tenant_id, id) on delete cascade,
  constraint contact_notes_body_check check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists contact_notes_contact_idx on contact_notes (tenant_id, contact_id, created_at desc);
