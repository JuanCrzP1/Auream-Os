-- Líneas de venta: partes del negocio que se miden aparte en el Dashboard
-- («Venezuela», «Dilo cantando Colombia»). Cada una junta los productos que
-- vende, los números por los que vende (vacío = todos) y las campañas de Meta
-- que la promocionan (su gasto es el de la línea).
--
--   product_ids     productos de la línea (ids de `products`)
--   connection_ids  números de la línea; vacío = todos
--   campaign_ids    campañas de Meta (ids externos de `ad_entities.campaign_id`)
--
-- Los ids se guardan como listas: un producto o campaña que ya no existe
-- simplemente deja de sumar. Aditiva: no toca nada existente.

create table if not exists sales_lines (
  id              uuid        primary key,
  tenant_id       uuid        not null references tenants (id) on delete cascade,
  name            text        not null,
  color           text        not null,
  product_ids     uuid[]      not null default '{}',
  connection_ids  uuid[]      not null default '{}',
  campaign_ids    text[]      not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sales_lines_name_check check (char_length(btrim(name)) between 1 and 40),
  constraint sales_lines_color_check check (color ~ '^#[0-9a-f]{6}$'),
  constraint sales_lines_scope_check check (cardinality(product_ids) + cardinality(campaign_ids) > 0)
);

-- Dos líneas de la misma cuenta no se llaman igual (sin importar mayúsculas).
create unique index if not exists sales_lines_name_unique on sales_lines (tenant_id, lower(btrim(name)));
