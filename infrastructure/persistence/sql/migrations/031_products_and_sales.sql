-- Ventas y Productos (G7).
--
-- `products`: el catálogo de cada cuenta (nombre, descripción, tipo y estado).
-- `product_prices`: el precio de cada producto en cada país, en su moneda.
-- `sales`: cada venta, con su origen (bloque Registrar venta, un asesor o un
--   webhook), el producto y el monto, el cliente, la conexión y el flujo que
--   vendieron y el anuncio de origen. Solo las «approved» cuentan en los
--   totales; «review» espera que alguien la complete; «void» se anuló.
--
-- `product_name` es una copia: si el producto se renombra o archiva, la venta
-- dice lo que se vendió. `origin_key` evita registrar dos veces el mismo
-- comprobante (o el mismo paso de un flujo que se reintenta).
--
-- Aditiva: la versión que sirve sigue igual.

create table if not exists products (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  name        text        not null,
  description text        not null default '',
  kind        text        not null default 'main',
  status      text        not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint products_tenant_id_unique unique (tenant_id, id),
  constraint products_name_check check (length(btrim(name)) between 1 and 80),
  constraint products_description_check check (length(description) <= 500),
  constraint products_kind_check check (kind in ('main', 'upsell', 'downsell')),
  constraint products_status_check check (status in ('active', 'archived'))
);

-- Dos productos de la misma cuenta no se llaman igual (sin importar mayúsculas).
create unique index if not exists products_tenant_name_idx on products (tenant_id, lower(name));

create table if not exists product_prices (
  product_id uuid          not null references products (id) on delete cascade,
  tenant_id  uuid          not null references tenants (id) on delete cascade,
  country    char(2)       not null,
  currency   char(3)       not null,
  amount     numeric(14,2) not null,
  primary key (product_id, country),
  constraint product_prices_product_fk foreign key (tenant_id, product_id) references products (tenant_id, id) on delete cascade,
  constraint product_prices_amount_check check (amount > 0)
);

create table if not exists sales (
  id                uuid          primary key default gen_random_uuid(),
  tenant_id         uuid          not null references tenants (id) on delete cascade,
  status            text          not null,
  source            text          not null,
  product_id        uuid          null,
  product_name      text          null,
  amount            numeric(14,2) null,
  currency          char(3)       null,
  country           char(2)       null,
  contact_id        uuid          null,
  customer_name     text          null,
  customer_phone    text          null,
  connection_id     uuid          null,
  flow_key          text          null,
  ad_source_id      text          null,
  receipt_reference text          null,
  origin_key        text          null,
  review_reason     text          null,
  note              text          not null default '',
  recorded_by       uuid          null,
  sold_at           timestamptz   not null default now(),
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now(),
  -- Si el producto o el contacto se borran, la venta queda (con su copia del nombre).
  constraint sales_product_fk foreign key (product_id) references products (id) on delete set null,
  constraint sales_contact_fk foreign key (contact_id) references contacts (id) on delete set null,
  constraint sales_status_check check (status in ('approved', 'review', 'void')),
  constraint sales_source_check check (source in ('receipt', 'manual', 'webhook')),
  constraint sales_amount_check check (amount is null or amount > 0),
  -- Una venta aprobada siempre está completa: lo garantiza la base, no solo el código.
  constraint sales_approved_complete_check check (status <> 'approved' or (product_id is not null and amount is not null and currency is not null)),
  constraint sales_note_check check (length(note) <= 500)
);

-- Un mismo comprobante (o paso de flujo) no se registra dos veces en la cuenta.
create unique index if not exists sales_origin_idx on sales (tenant_id, origin_key) where origin_key is not null;
-- La lista (la más reciente primero) y los totales por periodo.
create index if not exists sales_tenant_sold_idx on sales (tenant_id, sold_at desc, id desc);
-- La pestaña «Por revisar» y su número.
create index if not exists sales_tenant_status_idx on sales (tenant_id, status, sold_at desc);
-- Las ventas de un producto (el número en el catálogo y el filtro).
create index if not exists sales_tenant_product_idx on sales (tenant_id, product_id) where product_id is not null;
