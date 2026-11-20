-- Auditoría: lo que alguien hizo con datos sensibles de la cuenta. Hoy, las
-- descargas con datos de clientes (ventas, miembros de un grupo): quién, qué,
-- de dónde, cuántas filas y cuándo. Solo se agrega; nunca se edita. Aditiva.
--
-- `actor_id` es texto: una persona (uuid), una credencial o la clave de
-- desarrollo. `request_id` une el evento con los registros de esa petición.

create table if not exists audit_events (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  type        text        not null,
  actor_id    text        not null,
  request_id  text        not null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null,
  constraint audit_events_type_check check (length(btrim(type)) between 1 and 60),
  constraint audit_events_actor_check check (length(btrim(actor_id)) between 1 and 200),
  constraint audit_events_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists audit_events_tenant_idx on audit_events (tenant_id, created_at desc);
create index if not exists audit_events_type_idx on audit_events (tenant_id, type, created_at desc);
