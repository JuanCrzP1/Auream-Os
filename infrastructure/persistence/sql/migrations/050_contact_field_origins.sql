-- Campos del cliente: de dónde salió el dato de cada cliente (la ficha dice
-- «Lo respondió en "¿En qué ciudad estás?"» o «Lo cambió Ana»). Una fila por
-- cliente y clave: solo el último origen. El nombre del bloque NO se guarda:
-- se busca al leer en el flujo (`flow_key`), así un bloque renombrado se ve
-- con su nombre de hoy. Aditiva: no toca nada existente.

create table if not exists contact_field_origins (
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  contact_id  uuid        not null references contacts (id) on delete cascade,
  key         text        not null,
  source      text        not null,
  flow_key    text        null,
  actor_id    text        null,
  updated_at  timestamptz not null default now(),
  constraint contact_field_origins_pk primary key (contact_id, key),
  constraint contact_field_origins_source_check check (source in ('flow', 'team'))
);

create index if not exists contact_field_origins_tenant_key_idx on contact_field_origins (tenant_id, key);
