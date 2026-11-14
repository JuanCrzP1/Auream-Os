-- Datos del negocio en el tiempo (entrega B). Aditiva.
--
-- 1. Cambio programado: otro valor de un dato entre dos instantes (el horario
--    de Navidad). No hay tareas: el valor del momento se decide al leer (el
--    programado si `now` está entre `starts_at` y `ends_at`, si no el de
--    siempre). Terminar antes uno activo pone `ends_at = now()`. Dos del mismo
--    dato no se cruzan: lo revisa el servidor con el dato bloqueado.
-- 2. Historial: quién cambió qué y cuándo. Va por CLAVE y sin llave foránea al
--    dato: si lo borran y lo crean otra vez con la misma clave, se ve su pasado.
--    Se guardan los últimos 50 por dato.

create table if not exists business_data_schedules (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  datum_id    uuid        not null references business_data (id) on delete cascade,
  value       text        not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  note        text        not null default '',
  -- Quién lo programó (texto: la clave de desarrollo no es un uuid).
  created_by  text        null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint business_data_schedules_range_check check (ends_at > starts_at),
  constraint business_data_schedules_value_check check (char_length(value) between 1 and 1000),
  constraint business_data_schedules_note_check check (char_length(note) <= 60)
);

create index if not exists business_data_schedules_datum_idx on business_data_schedules (tenant_id, datum_id, ends_at);

create table if not exists business_data_changes (
  id          uuid        primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  datum_key   text        not null,
  kind        text        not null,
  -- Lo que cambió (antes y después, o el programado), como lo define el contrato.
  detail      jsonb       not null,
  -- El tipo del dato cuando pasó: «true» se lee «Sí».
  value_type  text        not null,
  actor_id    text        null,
  created_at  timestamptz not null default now(),
  constraint business_data_changes_kind_check check (kind in ('created', 'value', 'label', 'type', 'description', 'scheduled', 'rescheduled', 'unscheduled', 'ended', 'deleted')),
  constraint business_data_changes_type_check check (value_type in ('text', 'number', 'date', 'boolean'))
);

create index if not exists business_data_changes_key_idx on business_data_changes (tenant_id, datum_key, created_at desc);
