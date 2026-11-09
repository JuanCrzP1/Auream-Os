-- Credenciales de los agentes de IA (MCP): cada una con permisos por área.
-- El token no se guarda: solo su huella SHA-256 (única) y una pista. Aditiva.

create table if not exists mcp_credentials (
  id           uuid        primary key,
  tenant_id    uuid        not null references tenants (id) on delete cascade,
  name         text        not null,
  permissions  jsonb       not null,
  token_hash   text        not null,
  hint         text        not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz null,
  expires_at   timestamptz null,
  constraint mcp_credentials_name_check check (length(btrim(name)) between 1 and 60),
  constraint mcp_credentials_permissions_check check (jsonb_typeof(permissions) = 'object'),
  constraint mcp_credentials_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists mcp_credentials_hash_unique on mcp_credentials (token_hash);
create index if not exists mcp_credentials_tenant_idx on mcp_credentials (tenant_id, created_at);
