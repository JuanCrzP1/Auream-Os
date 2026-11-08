-- Conexiones de la cuenta con proveedores de IA (OpenAI, Gemini, OpenRouter).
--
-- La clave de API NUNCA se guarda en claro: `secret` es un sobre AES-256-GCM
-- (`<versión>.<iv>.<etiqueta>.<cifrado>`) atado a esta cuenta y esta conexión;
-- copiado a otra fila no se puede descifrar. `secret_hint` son sus últimos
-- caracteres, lo único que se muestra.

create table if not exists ai_credentials (
  id               uuid        primary key,
  tenant_id        uuid        not null references tenants (id) on delete cascade,
  provider         text        not null,
  name             text        not null,
  secret           text        not null,
  secret_hint      text        not null,
  status           text        not null default 'active',
  last_verified_at timestamptz null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ai_credentials_provider_check check (provider in ('openai', 'gemini', 'openrouter')),
  constraint ai_credentials_status_check check (status in ('active', 'invalid')),
  constraint ai_credentials_name_check check (length(btrim(name)) between 1 and 60),
  constraint ai_credentials_secret_check check (secret ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$'),
  constraint ai_credentials_hint_check check (length(secret_hint) <= 12)
);

-- «OpenAI» y «openai» son el mismo nombre dentro de una cuenta.
create unique index if not exists ai_credentials_tenant_name_unique on ai_credentials (tenant_id, lower(name));
create index if not exists ai_credentials_tenant_idx on ai_credentials (tenant_id, created_at);
