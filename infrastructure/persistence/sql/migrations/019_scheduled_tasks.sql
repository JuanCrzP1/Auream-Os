-- Cola de tareas programadas (FASE C6): «haz esto a tal hora». Genérica: el
-- tipo (`kind`) decide qué se ejecuta; la cola solo sabe cuándo, cuántos
-- intentos y cómo terminó. La usan los despertadores de los flujos
-- (Programador, tiempos de espera, pausas largas).
--
-- Reserva atómica entre procesos: `for update skip locked` + `locked_until`
-- (si quien la tomó muere, la reserva caduca y otra ronda la retoma).

create table if not exists scheduled_tasks (
  id            uuid        primary key,
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  kind          text        not null,
  group_key     text        not null,
  dedupe_key    text        not null,
  payload       jsonb       not null default '{}'::jsonb,
  status        text        not null default 'pending',
  due_at        timestamptz not null,
  attempts      integer     not null default 0,
  max_attempts  integer     not null default 5,
  locked_until  timestamptz null,
  last_error    text        null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz null,
  constraint scheduled_tasks_status_check check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  constraint scheduled_tasks_kind_check check (length(btrim(kind)) between 1 and 60),
  constraint scheduled_tasks_attempts_check check (attempts >= 0 and max_attempts between 1 and 20),
  constraint scheduled_tasks_payload_check check (jsonb_typeof(payload) = 'object')
);

-- Programar dos veces lo mismo deja una sola tarea.
create unique index if not exists scheduled_tasks_dedupe_unique on scheduled_tasks (dedupe_key);

-- Lo que la ronda busca: pendientes por vencimiento y reservas caducadas.
create index if not exists scheduled_tasks_due_idx on scheduled_tasks (due_at) where status = 'pending';
create index if not exists scheduled_tasks_lease_idx on scheduled_tasks (locked_until) where status = 'running';

-- Cancelar las pendientes de una conversación.
create index if not exists scheduled_tasks_group_idx on scheduled_tasks (tenant_id, group_key) where status = 'pending';

-- Limpieza de las terminadas.
create index if not exists scheduled_tasks_finished_idx on scheduled_tasks (finished_at) where finished_at is not null;
