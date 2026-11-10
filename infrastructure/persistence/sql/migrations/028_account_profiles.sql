-- Perfil de cada usuario y datos de la empresa (Mi perfil y Empresa).
--
-- `user_profiles`: lo que la app muestra de una persona (nombre, WhatsApp
-- personal y foto). El correo y la contraseña siguen en Neon Auth, la única
-- autoridad de credenciales. `user_id` NO tiene FK hacia neon_auth."user" por
-- la misma razón que `memberships` (ese esquema lo administra Neon).
-- `display_name` nulo = todavía usa el nombre con el que se registró.
--
-- `tenants`: logo de la empresa y su zona horaria. Nula = la de la plataforma
-- (`DEFAULT_TENANT_TIMEZONE`). La usan el Programador, los horarios y las
-- fechas de los flujos.
--
-- Las fotos y logos viven en el almacén de medios (Vercel Blob): aquí solo su
-- ruta (para borrarlos al cambiarlos) y su dirección pública.

create table if not exists user_profiles (
  user_id        uuid        primary key,
  display_name   text,
  phone          text,
  photo_pathname text,
  photo_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint user_profiles_name_check  check (display_name is null or char_length(display_name) between 1 and 80),
  constraint user_profiles_phone_check check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  constraint user_profiles_photo_check check ((photo_pathname is null) = (photo_url is null))
);

alter table tenants add column if not exists timezone      text;
alter table tenants add column if not exists logo_pathname text;
alter table tenants add column if not exists logo_url      text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_name_length_check') then
    alter table tenants add constraint tenants_name_length_check check (char_length(name) between 1 and 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_logo_check') then
    alter table tenants add constraint tenants_logo_check check ((logo_pathname is null) = (logo_url is null));
  end if;
end $$;
