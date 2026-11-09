-- Historial INTERNO de los turnos de los flujos (no es una pantalla): por cada
-- turno, qué lo inició, por qué bloques pasó, qué salió y qué falló, qué
-- espera quedó programada y si algo reventó. Para revisar cuando algo se
-- traba. Se guarda 14 días (lo borra `SqlFlowTurnJournal`). Aditiva.

create table if not exists flow_turn_log (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references tenants (id) on delete cascade,
  conversation_id  uuid        null,
  conversation_key text        not null,
  flow_key         text        not null,
  origin           text        not null,
  trigger          text        not null default '',
  started_at       timestamptz not null,
  finished_at      timestamptz not null,
  steps            jsonb       not null default '[]',
  events           jsonb       not null default '[]',
  session_node     text        null,
  session_status   text        null,
  sent             integer     not null default 0,
  failures         jsonb       not null default '[]',
  wake_up          jsonb       null,
  error            text        null,
  constraint flow_turn_log_origin_check check (origin in ('message', 'timer', 'manual'))
);

-- «qué pasó en este chat», lo más reciente primero
create index if not exists flow_turn_log_conversation_idx on flow_turn_log (tenant_id, conversation_key, started_at desc);
-- limpieza
create index if not exists flow_turn_log_started_idx on flow_turn_log (started_at);
