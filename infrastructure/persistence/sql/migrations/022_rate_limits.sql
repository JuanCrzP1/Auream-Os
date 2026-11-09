-- Límite de peticiones compartido por todas las instancias de Vercel: un
-- contador por clave (p. ej. «api:tenant:<id>») y ventana fija de tiempo. Lo
-- escribe `SqlRateLimiter` con una sola sentencia atómica; las ventanas viejas
-- se borran solas. Aditiva.

create table if not exists rate_limit_counters (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start),
  constraint rate_limit_counters_key_check check (length(key) between 1 and 200)
);

-- Limpieza de ventanas vencidas.
create index if not exists rate_limit_counters_window_idx on rate_limit_counters (window_start);
