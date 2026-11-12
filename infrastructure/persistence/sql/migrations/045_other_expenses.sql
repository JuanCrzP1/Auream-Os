-- Otros gastos: lo que el negocio paga fuera de Meta (herramientas, sueldos,
-- la comisión de la pasarela…). Se restan de la ganancia del Dashboard; el
-- ROAS sigue siendo solo contra Meta.
--
--   kind       fixed: un monto en `currency` que se repite según `frequency`
--              percent: un % (`amount`) de lo vendido mientras esté vigente
--   frequency  once | daily | weekly | monthly (solo `fixed`)
--   starts_on  desde cuándo (y el día en que se cobra: el día de la semana o
--              del mes); `ends_on` opcional
--   line_id    una línea de venta, o `null` = todo el negocio. Si se borra la
--              línea, el gasto pasa a todo el negocio (el gasto sigue existiendo).
--
-- Aditiva: no toca nada existente.

create table if not exists other_expenses (
  id          uuid          primary key,
  tenant_id   uuid          not null references tenants (id) on delete cascade,
  name        text          not null,
  kind        text          not null,
  amount      numeric(14,4) not null,
  currency    char(3)       null,
  frequency   text          null,
  starts_on   date          not null,
  ends_on     date          null,
  line_id     uuid          null references sales_lines (id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  constraint other_expenses_name_check check (char_length(btrim(name)) between 1 and 60),
  constraint other_expenses_kind_check check (kind in ('fixed', 'percent')),
  constraint other_expenses_amount_check check (amount > 0 and (kind <> 'percent' or amount <= 100)),
  constraint other_expenses_fixed_check check (
    (kind = 'fixed' and currency is not null and frequency in ('once', 'daily', 'weekly', 'monthly'))
    or (kind = 'percent' and currency is null and frequency is null)
  ),
  constraint other_expenses_dates_check check (ends_on is null or ends_on >= starts_on)
);

create index if not exists other_expenses_tenant_idx on other_expenses (tenant_id, line_id);
