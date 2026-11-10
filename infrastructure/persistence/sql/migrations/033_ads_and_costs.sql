-- Meta Ads (G8), el cambio de moneda del Dashboard (G1) y el costo de cada
-- producto (la ganancia real).
--
-- `meta_connections`: la conexión de la cuenta con Meta (una por cuenta): el
--   token cifrado (AES-GCM, contexto `tenantId:meta`), quién conectó, cómo
--   (inicio de sesión o token pegado) y cuándo vence.
-- `ad_accounts`: las cuentas publicitarias que ve ese token; solo las
--   `enabled` se sincronizan. Moneda y zona son las de la cuenta en Meta.
-- `ad_entities`: campañas, conjuntos y anuncios (con su padre), para nombrar
--   y agrupar lo que gasta cada anuncio.
-- `ad_insights_daily`: lo que reporta Meta por anuncio y por día, en la
--   moneda de la cuenta. La venta real sale de `sales.ad_source_id`.
-- `fx_rates`: unidades de cada moneda por 1 USD, por día (para comparar
--   ventas en pesos o dólares con un gasto en otra moneda).
-- `product_prices.cost`: lo que le cuesta al negocio cada producto en ese país.
--
-- Aditiva: la versión que sirve sigue igual.

create table if not exists meta_connections (
  tenant_id        uuid        primary key references tenants (id) on delete cascade,
  method           text        not null,
  token_ciphertext text        not null,
  meta_user_id     text        null,
  meta_user_name   text        null,
  connected_by     uuid        null,
  expires_at       timestamptz null,
  last_error       text        null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint meta_connections_method_check check (method in ('oauth', 'token'))
);

create table if not exists ad_accounts (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      uuid        not null references tenants (id) on delete cascade,
  provider       text        not null default 'meta',
  external_id    text        not null,
  name           text        not null,
  currency       char(3)     not null,
  timezone       text        not null default 'UTC',
  provider_status integer    null,
  enabled        boolean     not null default false,
  last_synced_at timestamptz null,
  last_error     text        null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ad_accounts_tenant_id_unique unique (tenant_id, id),
  constraint ad_accounts_external_unique unique (tenant_id, provider, external_id)
);

create table if not exists ad_entities (
  tenant_id    uuid          not null references tenants (id) on delete cascade,
  account_id   uuid          not null,
  level        text          not null,
  external_id  text          not null,
  parent_id    text          null,
  campaign_id  text          null,
  name         text          not null,
  status       text          not null default 'UNKNOWN',
  daily_budget numeric(14,2) null,
  thumbnail_url text         null,
  updated_at   timestamptz   not null default now(),
  primary key (account_id, external_id),
  constraint ad_entities_account_fk foreign key (tenant_id, account_id) references ad_accounts (tenant_id, id) on delete cascade,
  constraint ad_entities_level_check check (level in ('campaign', 'adset', 'ad'))
);

-- La venta trae el id del anuncio (`sales.ad_source_id`): se busca por cuenta y anuncio.
create index if not exists ad_entities_lookup_idx on ad_entities (tenant_id, level, external_id);

create table if not exists ad_insights_daily (
  tenant_id       uuid          not null references tenants (id) on delete cascade,
  account_id      uuid          not null,
  ad_id           text          not null,
  day             date          not null,
  spend           numeric(14,2) not null default 0,
  impressions     bigint        not null default 0,
  clicks          bigint        not null default 0,
  conversations   integer       not null default 0,
  meta_purchases  integer       not null default 0,
  meta_revenue    numeric(14,2) not null default 0,
  primary key (account_id, ad_id, day),
  constraint ad_insights_account_fk foreign key (tenant_id, account_id) references ad_accounts (tenant_id, id) on delete cascade
);

create index if not exists ad_insights_tenant_day_idx on ad_insights_daily (tenant_id, day);

create table if not exists fx_rates (
  day      date          not null,
  currency char(3)       not null,
  per_usd  numeric(20,6) not null,
  primary key (day, currency),
  constraint fx_rates_positive_check check (per_usd > 0)
);

alter table product_prices add column if not exists cost numeric(14,2) null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_prices_cost_check') then
    alter table product_prices add constraint product_prices_cost_check check (cost is null or cost >= 0);
  end if;
end $$;
