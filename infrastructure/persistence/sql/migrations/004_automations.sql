-- Automatizaciones: carpetas, catálogo y borrador de cada flujo.
--
-- Todo pertenece a un tenant (`tenant_id` obligatorio, con FK y en cascada):
-- es la frontera de aislamiento de la plataforma. Cada consulta de los
-- repositorios filtra por él.
--
-- Decisión (FASE C1, 2026-11-08): el flujo se guarda como UN DOCUMENTO
-- (`automation_drafts.snapshot`, jsonb), no como filas de bloques y
-- conexiones. El editor lo lee y lo escribe siempre entero (autoguardado), y
-- su forma ya la define y migra el contrato `BuilderFlowSnapshot`.
--
-- No hay publicación ni versiones: lo guardado es lo que corre.

create table if not exists automation_folders (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references tenants (id) on delete cascade,
  name             text        not null,
  parent_folder_id uuid        null references automation_folders (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint automation_folders_name_check check (length(btrim(name)) > 0)
);

create index if not exists automation_folders_tenant_idx on automation_folders (tenant_id);

-- El catálogo: lo que lista el hub.
--
-- `key` es el identificador del flujo en URLs y en el builder; hoy coincide
-- con `id`, pero son conceptos distintos y se guardan por separado.
create table if not exists automations (
  id         uuid        primary key,
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  key        text        not null,
  name       text        not null,
  status     text        not null default 'draft',
  folder_id  uuid        null references automation_folders (id) on delete set null,
  tags       text[]      not null default '{}',
  created_by uuid        null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automations_tenant_key_unique unique (tenant_id, key),
  constraint automations_name_check check (length(btrim(name)) > 0),
  constraint automations_status_check check (status in ('active', 'paused', 'draft', 'archived'))
);

-- "las automatizaciones de esta cuenta", ordenadas como las muestra el hub
create index if not exists automations_tenant_updated_idx on automations (tenant_id, updated_at desc);
create index if not exists automations_folder_idx on automations (folder_id) where folder_id is not null;

-- El borrador de cada automatización: el flujo completo.
--
-- Va en su propia tabla para que listar el catálogo no arrastre los
-- documentos. Cuelga de (tenant_id, key) en cascada: borrar la automatización
-- borra su borrador en la misma operación.
--
-- `revision` sube en cada guardado: es la base del bloqueo optimista (C4).
create table if not exists automation_drafts (
  tenant_id  uuid        not null,
  flow_key   text        not null,
  snapshot   jsonb       not null,
  revision   integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, flow_key),
  constraint automation_drafts_automation_fk
    foreign key (tenant_id, flow_key) references automations (tenant_id, key) on delete cascade,
  constraint automation_drafts_snapshot_check check (jsonb_typeof(snapshot) = 'object'),
  constraint automation_drafts_revision_check check (revision >= 0)
);
