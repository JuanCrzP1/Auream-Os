-- Datos del negocio (Configuración › Datos › Datos del negocio): lo que se
-- repite en los mensajes de la cuenta (Pago Móvil, horario, dirección, enlace
-- del grupo) escrito una sola vez. Se usan como `{g_clave}` en flujos,
-- difusiones y respuestas rápidas, y en el Condicional. Los flujos los leen,
-- nunca los cambian. El valor se guarda «a lo computador» según su tipo
-- (número `1200000`, sí o no `true`, fecha `2026-12-24`). Aditiva.

create table if not exists business_data (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  key         text        not null,
  label       text        not null,
  type        text        not null,
  value       text        not null,
  description text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Quién lo cambió por última vez (texto: la clave de desarrollo no es un uuid).
  updated_by  text        null,
  constraint business_data_key_unique unique (tenant_id, key),
  constraint business_data_key_check check (key ~ '^g_[a-z0-9_]{1,40}$'),
  constraint business_data_label_check check (char_length(label) between 1 and 40),
  constraint business_data_type_check check (type in ('text', 'number', 'date', 'boolean')),
  constraint business_data_value_check check (char_length(value) between 1 and 1000),
  constraint business_data_description_check check (char_length(description) <= 140)
);

create index if not exists business_data_tenant_idx on business_data (tenant_id, created_at);
