-- Medios subidos por cada cuenta (imágenes, videos, audios y documentos).
--
-- Los bytes viven en el almacén de objetos (Vercel Blob); aquí queda el
-- registro verificado por el servidor: de qué cuenta es, su tipo, tamaño y
-- URL pública. La ruta siempre está dentro de la carpeta de la cuenta.

create table if not exists media_assets (
  id           uuid        primary key,
  tenant_id    uuid        not null references tenants (id) on delete cascade,
  kind         text        not null,
  pathname     text        not null,
  url          text        not null,
  content_type text        not null,
  size_bytes   bigint      not null,
  file_name    text        not null,
  created_at   timestamptz not null default now(),
  constraint media_assets_kind_check check (kind in ('image', 'video', 'audio', 'file')),
  constraint media_assets_size_check check (size_bytes > 0 and size_bytes <= 104857600),
  constraint media_assets_pathname_check check (pathname like 'tenants/' || tenant_id::text || '/media/%'),
  constraint media_assets_pathname_unique unique (pathname)
);

create index if not exists media_assets_tenant_idx on media_assets (tenant_id, created_at desc);
