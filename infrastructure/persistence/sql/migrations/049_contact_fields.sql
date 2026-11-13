-- Campos del cliente (Configuración › Datos › Campos del cliente): el catálogo
-- de datos de la cuenta con nombre, clave y tipo. El valor de cada cliente
-- sigue en `contacts.custom_fields` (jsonb) con la misma clave: definir un
-- campo no mueve datos. Aditiva: no toca nada existente.

create table if not exists contact_field_definitions (
  id         uuid        primary key,
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  key        text        not null,
  label      text        not null,
  type       text        not null,
  options    jsonb       not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_field_definitions_key_unique unique (tenant_id, key),
  constraint contact_field_definitions_key_check check (key ~ '^[A-Za-z_][A-Za-z0-9_.-]{0,63}$'),
  constraint contact_field_definitions_label_check check (char_length(label) between 1 and 40),
  constraint contact_field_definitions_type_check check (type in ('text', 'number', 'date', 'boolean', 'list')),
  constraint contact_field_definitions_options_check check (jsonb_typeof(options) = 'array')
);

create index if not exists contact_field_definitions_tenant_idx on contact_field_definitions (tenant_id, created_at);
