-- Etiquetas (Configuración › Datos › Etiquetas): unir una etiqueta en otra
-- (también «pasar y borrar»). Primero se cambian sus usos (flujos, webhooks,
-- difusiones por enviar, públicos guardados); después sus clientes pasan a
-- la otra por tandas en la cola de tareas, por el mismo camino de siempre
-- (las etapas del CRM se respetan y el embudo queda al día). Al terminar, la
-- etiqueta de origen se borra. Aditiva.

create table if not exists label_merges (
  id            uuid        primary key,
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  -- Sin llave foránea: al terminar, la de origen ya no existe.
  from_label_id uuid        not null,
  from_name     text        not null,
  into_label_id uuid        not null,
  into_name     text        not null,
  total         integer     not null default 0,
  moved         integer     not null default 0,
  status        text        not null default 'running',
  error         text        null,
  -- Quién la pidió (texto: la clave de desarrollo no es un uuid).
  created_by    text        null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz null,
  constraint label_merges_status_check check (status in ('running', 'done', 'failed')),
  constraint label_merges_counts_check check (total >= 0 and moved >= 0)
);

create index if not exists label_merges_tenant_idx on label_merges (tenant_id, created_at desc);
-- Una etiqueta no se une dos veces a la vez.
create unique index if not exists label_merges_running_idx on label_merges (tenant_id, from_label_id) where status = 'running';
