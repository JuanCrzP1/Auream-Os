-- OAuth 2.1 del servidor MCP (Claude en la web y en la app de escritorio).
--
-- Una credencial puede ser de tipo `token` (la de siempre: token fijo) o
-- `oauth` (la autoriza el usuario desde el agente; sin token fijo, sus tokens
-- rotan). Los agentes se registran solos (RFC 7591); los códigos de
-- autorización y los tokens se guardan solo como huella SHA-256 y se borran
-- con su credencial. Aditiva: las credenciales existentes quedan `token`.

alter table mcp_credentials add column if not exists kind text not null default 'token';
alter table mcp_credentials add column if not exists client_id text null;
alter table mcp_credentials alter column token_hash drop not null;

alter table mcp_credentials drop constraint if exists mcp_credentials_kind_check;
alter table mcp_credentials add constraint mcp_credentials_kind_check check (
  (kind = 'token' and token_hash is not null) or (kind = 'oauth' and token_hash is null and client_id is not null)
);

create index if not exists mcp_credentials_client_idx on mcp_credentials (tenant_id, client_id) where client_id is not null;

create table if not exists mcp_oauth_clients (
  client_id     text        primary key,
  name          text        not null,
  redirect_uris jsonb       not null,
  created_at    timestamptz not null default now(),
  constraint mcp_oauth_clients_uris_check check (jsonb_typeof(redirect_uris) = 'array')
);

create table if not exists mcp_oauth_codes (
  code_hash      text        primary key,
  client_id      text        not null references mcp_oauth_clients (client_id) on delete cascade,
  credential_id  uuid        not null references mcp_credentials (id) on delete cascade,
  redirect_uri   text        not null,
  code_challenge text        not null,
  resource       text        null,
  expires_at     timestamptz not null,
  constraint mcp_oauth_codes_hash_check check (code_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists mcp_oauth_codes_expiry_idx on mcp_oauth_codes (expires_at);

create table if not exists mcp_oauth_tokens (
  id                 uuid        primary key,
  credential_id      uuid        not null references mcp_credentials (id) on delete cascade,
  client_id          text        not null references mcp_oauth_clients (client_id) on delete cascade,
  access_hash        text        not null,
  access_expires_at  timestamptz not null,
  refresh_hash       text        not null,
  refresh_expires_at timestamptz not null,
  created_at         timestamptz not null default now(),
  constraint mcp_oauth_tokens_hashes_check check (access_hash ~ '^[0-9a-f]{64}$' and refresh_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists mcp_oauth_tokens_access_unique on mcp_oauth_tokens (access_hash);
create unique index if not exists mcp_oauth_tokens_refresh_unique on mcp_oauth_tokens (refresh_hash);
create index if not exists mcp_oauth_tokens_credential_idx on mcp_oauth_tokens (credential_id);
create index if not exists mcp_oauth_tokens_expiry_idx on mcp_oauth_tokens (refresh_expires_at);
