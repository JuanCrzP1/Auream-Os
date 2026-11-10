-- CRM (G9): embudos con sus etapas, el cliente en cada embudo con su valor y
-- su responsable, el historial y los seguimientos.
--
-- Una etapa ES una etiqueta de Contactos (`label_id`): estar en la etapa es
-- tener la etiqueta. Así el bloque Etiquetas de los flujos, el chat y la
-- ficha mueven clientes de etapa sin un camino aparte. Una etiqueta es etapa
-- de un solo embudo (`crm_stages_label_idx`). Si se borra la etiqueta, la
-- etapa se va con ella.
--
-- `crm_deals` guarda lo que la etiqueta no dice: el valor, el producto, el
-- responsable y desde cuándo está en la etapa. `won_at` (la primera vez que
-- pasó a una etapa de compra) da el «vendido» y lo que tardan en comprar.
--
-- Aditiva: la versión que sirve sigue igual.

create table if not exists crm_pipelines (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          uuid        not null references tenants (id) on delete cascade,
  name               text        not null,
  position           integer     not null default 0,
  entry_stage_id     uuid        null,
  sale_stage_id      uuid        null,
  default_product_id uuid        null references products (id) on delete set null,
  auto_assign        boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint crm_pipelines_tenant_id_unique unique (tenant_id, id),
  constraint crm_pipelines_name_check check (length(btrim(name)) between 1 and 60)
);

create unique index if not exists crm_pipelines_tenant_name_idx on crm_pipelines (tenant_id, lower(name));

create table if not exists crm_stages (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  pipeline_id uuid        not null,
  label_id    uuid        not null,
  outcome     text        not null default 'open',
  position    integer     not null,
  created_at  timestamptz not null default now(),
  constraint crm_stages_tenant_id_unique unique (tenant_id, id),
  constraint crm_stages_pipeline_fk foreign key (tenant_id, pipeline_id) references crm_pipelines (tenant_id, id) on delete cascade,
  constraint crm_stages_label_fk foreign key (tenant_id, label_id) references contact_labels (tenant_id, id) on delete cascade,
  constraint crm_stages_outcome_check check (outcome in ('open', 'won', 'lost'))
);

-- Una etiqueta es etapa de un solo embudo de la cuenta.
create unique index if not exists crm_stages_label_idx on crm_stages (tenant_id, label_id);
create index if not exists crm_stages_pipeline_idx on crm_stages (pipeline_id, position);

-- La etapa de entrada y la de compra: si la etapa se quita, el ajuste queda vacío.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crm_pipelines_entry_fk') then
    alter table crm_pipelines add constraint crm_pipelines_entry_fk foreign key (entry_stage_id) references crm_stages (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'crm_pipelines_sale_fk') then
    alter table crm_pipelines add constraint crm_pipelines_sale_fk foreign key (sale_stage_id) references crm_stages (id) on delete set null;
  end if;
end $$;

create table if not exists crm_deals (
  tenant_id        uuid          not null references tenants (id) on delete cascade,
  pipeline_id      uuid          not null,
  contact_id       uuid          not null,
  stage_id         uuid          null references crm_stages (id) on delete set null,
  stage_entered_at timestamptz   not null default now(),
  first_entered_at timestamptz   not null default now(),
  won_at           timestamptz   null,
  amount           numeric(14,2) null,
  currency         char(3)       null,
  product_id       uuid          null references products (id) on delete set null,
  product_name     text          null,
  owner_id         uuid          null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  primary key (pipeline_id, contact_id),
  constraint crm_deals_pipeline_fk foreign key (tenant_id, pipeline_id) references crm_pipelines (tenant_id, id) on delete cascade,
  constraint crm_deals_contact_fk foreign key (tenant_id, contact_id) references contacts (tenant_id, id) on delete cascade,
  constraint crm_deals_amount_check check (amount is null or amount > 0),
  -- Un valor siempre lleva su moneda.
  constraint crm_deals_money_check check ((amount is null) = (currency is null))
);

create index if not exists crm_deals_contact_idx on crm_deals (tenant_id, contact_id);
create index if not exists crm_deals_won_idx on crm_deals (pipeline_id, won_at) where won_at is not null;

create table if not exists crm_events (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  pipeline_id   uuid        not null,
  contact_id    uuid        not null,
  kind          text        not null,
  -- Sin llave: el historial conserva la etapa aunque después se quite.
  from_stage_id uuid        null,
  to_stage_id   uuid        null,
  source        text        not null,
  actor_id      uuid        null,
  flow_key      text        null,
  detail        text        null,
  created_at    timestamptz not null default now(),
  constraint crm_events_pipeline_fk foreign key (tenant_id, pipeline_id) references crm_pipelines (tenant_id, id) on delete cascade,
  constraint crm_events_contact_fk foreign key (tenant_id, contact_id) references contacts (tenant_id, id) on delete cascade,
  constraint crm_events_kind_check check (kind in ('stage', 'left', 'owner', 'value')),
  constraint crm_events_source_check check (source in ('flow', 'user', 'sale', 'auto')),
  constraint crm_events_detail_check check (detail is null or length(detail) <= 300)
);

create index if not exists crm_events_contact_idx on crm_events (tenant_id, contact_id, created_at desc);

create table if not exists crm_follow_ups (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  contact_id  uuid        not null,
  title       text        not null,
  due_at      timestamptz not null,
  assignee_id uuid        null,
  created_by  uuid        null,
  done_at     timestamptz null,
  done_by     uuid        null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint crm_follow_ups_contact_fk foreign key (tenant_id, contact_id) references contacts (tenant_id, id) on delete cascade,
  constraint crm_follow_ups_title_check check (length(btrim(title)) between 1 and 140)
);

-- Los pendientes por fecha (Vencidos · Hoy · Próximos) y los de cada cliente.
create index if not exists crm_follow_ups_pending_idx on crm_follow_ups (tenant_id, due_at) where done_at is null;
create index if not exists crm_follow_ups_contact_idx on crm_follow_ups (tenant_id, contact_id, due_at);
