-- Grupos y comunidades de WhatsApp.
--
--   group_campaigns        una campaña: enlace único (`slug`, público y único en
--                          toda la plataforma), números, cupo, plantilla y reglas
--   wa_groups              los grupos de cada número (traídos de WhatsApp o
--                          creados por una campaña, con su posición « #n»)
--   wa_group_members       quién está o estuvo en cada grupo (entradas y salidas)
--   group_link_clicks      cada clic al enlace de una campaña
--   group_posts            mensajes a muchos grupos, ahora o programados
--   group_post_deliveries  cada grupo de un envío y cómo le fue
--
-- Lo vendido no se copia: se cruza al leer con Ventas (quien estaba en el
-- grupo cuando compró). Aditiva: no toca nada existente.

create table if not exists group_campaigns (
  id             uuid        primary key,
  tenant_id      uuid        not null references tenants (id) on delete cascade,
  name           text        not null,
  slug           text        not null,
  status         text        not null default 'active',
  connection_ids uuid[]      not null,
  capacity       integer     not null,
  template       jsonb       not null,
  rules          jsonb       not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint group_campaigns_slug_unique unique (slug),
  constraint group_campaigns_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  constraint group_campaigns_status_check check (status in ('active', 'closed')),
  constraint group_campaigns_capacity_check check (capacity between 20 and 1024),
  constraint group_campaigns_name_check check (length(btrim(name)) between 1 and 60)
);

create index if not exists group_campaigns_tenant_idx on group_campaigns (tenant_id, created_at desc);

create table if not exists wa_groups (
  id              uuid        primary key,
  tenant_id       uuid        not null references tenants (id) on delete cascade,
  connection_id   uuid        not null references whatsapp_connections (id) on delete cascade,
  jid             text        not null,
  name            text        not null default '',
  description     text        not null default '',
  image_url       text        null,
  members         integer     not null default 0,
  is_admin        boolean     not null default false,
  announce        boolean     not null default false,
  locked          boolean     not null default false,
  invite_link     text        null,
  campaign_id     uuid        null references group_campaigns (id) on delete set null,
  position        integer     null,
  synced_at       timestamptz null,
  last_welcome_at timestamptz null,
  removed_at      timestamptz null,
  created_at      timestamptz not null default now(),
  constraint wa_groups_jid_check check (jid ~ '^[0-9-]+@g\.us$'),
  constraint wa_groups_unique unique (connection_id, jid)
);

create index if not exists wa_groups_tenant_idx on wa_groups (tenant_id) where removed_at is null;
-- Una posición « #n» por campaña: dos procesos no crean el mismo grupo dos veces.
create unique index if not exists wa_groups_campaign_position_idx on wa_groups (campaign_id, position) where campaign_id is not null;

create table if not exists wa_group_members (
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  group_id   uuid        not null references wa_groups (id) on delete cascade,
  member_key text        not null,
  phone      text        null,
  is_admin   boolean     not null default false,
  source     text        not null,
  joined_at  timestamptz not null,
  left_at    timestamptz null,
  primary key (group_id, member_key),
  constraint wa_group_members_source_check check (source in ('sync', 'event'))
);

-- «¿Estaba en un grupo cuando compró?» y la bienvenida de los que entraron.
create index if not exists wa_group_members_phone_idx on wa_group_members (tenant_id, phone) where phone is not null;
create index if not exists wa_group_members_joined_idx on wa_group_members (group_id, joined_at);

create table if not exists group_link_clicks (
  id          bigserial   primary key,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  campaign_id uuid        not null references group_campaigns (id) on delete cascade,
  group_id    uuid        null references wa_groups (id) on delete set null,
  source      text        null,
  created_at  timestamptz not null default now()
);

create index if not exists group_link_clicks_campaign_idx on group_link_clicks (campaign_id, created_at);

create table if not exists group_posts (
  id           uuid        primary key,
  tenant_id    uuid        not null references tenants (id) on delete cascade,
  content      jsonb       not null,
  mention_all  boolean     not null default false,
  status       text        not null,
  target       text        not null default '',
  campaign_ids uuid[]      not null default '{}',
  scheduled_at timestamptz null,
  finished_at  timestamptz null,
  created_at   timestamptz not null default now(),
  constraint group_posts_status_check check (status in ('scheduled', 'sending', 'done', 'cancelled'))
);

create index if not exists group_posts_tenant_idx on group_posts (tenant_id, created_at desc);

create table if not exists group_post_deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null references tenants (id) on delete cascade,
  post_id             uuid        not null references group_posts (id) on delete cascade,
  group_id            uuid        not null references wa_groups (id) on delete cascade,
  position            integer     not null,
  status              text        not null default 'pending',
  provider_message_id text        null,
  error               text        null,
  sent_at             timestamptz null,
  constraint group_post_deliveries_status_check check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  constraint group_post_deliveries_unique unique (post_id, group_id)
);

create index if not exists group_post_deliveries_next_idx on group_post_deliveries (post_id, position) where status = 'pending';
