-- Campos del cliente: ordenar valores y unir campos se pueden deshacer. Cada
-- operación guarda lo necesario para volver atrás: las definiciones como
-- estaban, los bloques de los flujos que cambió y, por cliente, su dato antes
-- y después (al deshacer solo se devuelve si nadie lo cambió luego).
-- Aditiva: no toca nada existente.

create table if not exists contact_field_operations (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  kind        text        not null,
  title       text        not null,
  contacts    integer     not null default 0,
  keys        text[]      not null,
  definitions jsonb       not null default '{"restore": [], "remove": []}',
  flows       jsonb       not null default '[]',
  created_by  text        null,
  created_at  timestamptz not null default now(),
  undone_at   timestamptz null,
  constraint contact_field_operations_kind_check check (kind in ('tidy', 'merge'))
);

create index if not exists contact_field_operations_tenant_idx on contact_field_operations (tenant_id, created_at desc);

create table if not exists contact_field_operation_values (
  operation_id uuid  not null references contact_field_operations (id) on delete cascade,
  contact_id   uuid  not null references contacts (id) on delete cascade,
  before       jsonb not null,
  after        jsonb not null,
  constraint contact_field_operation_values_pk primary key (operation_id, contact_id)
);
