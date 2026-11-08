-- Contactos, catálogo de etiquetas y su asignación.
--
-- Aislamiento por cuenta en la PROPIA base de datos: la asignación lleva
-- `tenant_id` y referencia contacto y etiqueta con claves compuestas
-- (tenant_id, id). Es imposible poner a un contacto una etiqueta de otra
-- cuenta, aunque un bug lo intentara.

create table if not exists contacts (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  channel       text        not null,
  -- Identidad en el canal: el teléfono (solo dígitos) en WhatsApp.
  external_key  text        not null,
  name          text        null,
  phone         text        null,
  email         text        null,
  custom_fields jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint contacts_identity_unique unique (tenant_id, channel, external_key),
  constraint contacts_tenant_id_unique unique (tenant_id, id),
  constraint contacts_custom_fields_check check (jsonb_typeof(custom_fields) = 'object'),
  constraint contacts_external_key_check check (length(btrim(external_key)) > 0)
);

create index if not exists contacts_tenant_updated_idx on contacts (tenant_id, updated_at desc);

create table if not exists contact_labels (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  name       text        not null,
  color      text        not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_labels_tenant_id_unique unique (tenant_id, id),
  constraint contact_labels_name_check check (length(btrim(name)) between 1 and 40),
  constraint contact_labels_color_check check (color ~ '^#[0-9a-fA-F]{6}$')
);

-- «VIP» y «vip» son la misma etiqueta dentro de una cuenta.
create unique index if not exists contact_labels_tenant_name_unique on contact_labels (tenant_id, lower(name));

create table if not exists contact_label_assignments (
  tenant_id  uuid        not null,
  contact_id uuid        not null,
  label_id   uuid        not null,
  created_at timestamptz not null default now(),
  primary key (contact_id, label_id),
  constraint contact_label_assignments_contact_fk
    foreign key (tenant_id, contact_id) references contacts (tenant_id, id) on delete cascade,
  constraint contact_label_assignments_label_fk
    foreign key (tenant_id, label_id) references contact_labels (tenant_id, id) on delete cascade
);

-- «contactos con esta etiqueta»
create index if not exists contact_label_assignments_label_idx on contact_label_assignments (label_id);
