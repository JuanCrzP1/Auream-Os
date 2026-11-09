-- La bandeja ordena y pagina por la última actividad de cada chat (su último
-- mensaje o, si aún no tiene, su creación) y su id, con filtro de fechas
-- sobre esa misma actividad. Este índice sirve las tres cosas.

create index if not exists conversations_activity_idx
  on conversations (tenant_id, (coalesce(last_message_at, created_at)) desc, id desc);

drop index if exists conversations_inbox_idx;

-- Filtro por etiquetas: «chats cuyo cliente tenga alguna de estas».
create index if not exists contact_label_assignments_contact_idx
  on contact_label_assignments (tenant_id, contact_id);
