-- Constancia de los borrados de datos que pide Meta (alguien quitó Auream de
-- su Facebook y pidió borrar su actividad). Solo lo necesario para que esa
-- persona consulte su solicitud con el código: NO se guarda quién es (su id
-- de Meta va como huella SHA-256), ni de qué cuenta de Auream era.
--
-- Aditiva: no toca nada existente.

create table if not exists meta_data_deletions (
  code                 text        primary key,
  user_hash            text        not null,
  deleted_connections  integer     not null default 0,
  requested_at         timestamptz not null default now(),
  constraint meta_data_deletions_code_check check (code ~ '^[A-Z2-9]{12}$'),
  constraint meta_data_deletions_count_check check (deleted_connections >= 0)
);

-- Para encontrar las conexiones de Meta Ads hechas por una persona de Meta.
create index if not exists meta_connections_user_idx on meta_connections (meta_user_id) where meta_user_id is not null;
