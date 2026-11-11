-- Ayuda y soporte.
--
--   help_tutorials         tutoriales en video (YouTube o Vimeo) que publica el
--                          equipo de Auream: son de la PLATAFORMA, los ven todas
--                          las cuentas
--   help_tutorial_views    quién vio qué (la marca «Visto» y las vistas)
--   help_feedback          «¿Te sirvió?» de cada artículo
--   support_cases          los casos que abre cada cuenta y su respuesta
--   platform_settings      ajustes de la plataforma (p. ej. cómo contactar a soporte)
--
-- Los artículos no van aquí: son Markdown del repositorio (`content/help`).
-- Aditiva: no toca nada existente.

create table if not exists help_tutorials (
  id            uuid        primary key,
  title         text        not null,
  description   text        not null default '',
  module        text        not null,
  url           text        not null,
  provider      text        not null,
  embed_url     text        not null,
  thumbnail_url text        null,
  duration      text        not null default '',
  article_slug  text        null,
  featured      boolean     not null default false,
  published     boolean     not null default false,
  position      integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint help_tutorials_provider_check check (provider in ('youtube', 'vimeo')),
  constraint help_tutorials_embed_check check (embed_url ~ '^https://(www\.youtube-nocookie\.com/embed/|player\.vimeo\.com/video/)')
);

create table if not exists help_tutorial_views (
  tutorial_id uuid        not null references help_tutorials (id) on delete cascade,
  user_id     uuid        not null,
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  seen_at     timestamptz not null default now(),
  primary key (tutorial_id, user_id)
);

create index if not exists help_tutorial_views_user_idx on help_tutorial_views (user_id);

create table if not exists help_feedback (
  id         bigserial   primary key,
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  user_id    uuid        not null,
  slug       text        not null,
  helpful    boolean     not null,
  comment    text        null,
  created_at timestamptz not null default now()
);

create index if not exists help_feedback_slug_idx on help_feedback (slug, created_at desc);

create table if not exists support_cases (
  id             uuid        primary key,
  tenant_id      uuid        not null references tenants (id) on delete cascade,
  user_id        uuid        not null,
  topic          text        not null,
  message        text        not null,
  page           text        not null default '/',
  screenshot_url text        null,
  article_slug   text        null,
  status         text        not null default 'open',
  reply          text        null,
  created_at     timestamptz not null default now(),
  answered_at    timestamptz null,
  constraint support_cases_status_check check (status in ('open', 'answered', 'closed')),
  constraint support_cases_message_check check (char_length(message) between 5 and 4000)
);

create index if not exists support_cases_user_idx on support_cases (tenant_id, user_id, created_at desc);
create index if not exists support_cases_status_idx on support_cases (status, created_at desc);

create table if not exists platform_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);
