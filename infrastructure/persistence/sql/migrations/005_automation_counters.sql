-- Contadores compartidos de las automatizaciones (FASE C10).
--
-- Hoy: los turnos del Distribuidor, que se reparten entre TODAS las
-- conversaciones de una cuenta. `SqlRoundRobinCounter` lee y avanza el valor
-- en una sola sentencia (insert … on conflict do update … returning), así que
-- dos clientes simultáneos nunca reciben el mismo turno.

create table if not exists automation_counters (
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  counter_key text        not null,
  value       bigint      not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, counter_key),
  constraint automation_counters_value_check check (value >= 0)
);
