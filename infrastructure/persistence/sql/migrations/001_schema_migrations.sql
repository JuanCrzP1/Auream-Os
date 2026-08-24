-- Control de migraciones aplicadas.
-- Se aplica primero: el runner necesita esta tabla para registrar el resto.
--
-- `checksum` permite detectar que una migración ya aplicada fue modificada
-- después. En ese caso el runner debe abortar, nunca reaplicar en silencio.

create table if not exists schema_migrations (
  name       text        primary key,
  checksum   text        not null,
  applied_at timestamptz not null default now()
);
