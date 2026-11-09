-- Credencial de la sesión de WhatsApp en el proveedor (p. ej. el token de la
-- instancia de uazapi). Con ella se envían mensajes desde el número: se
-- guarda cifrada (AES-256-GCM, sobre `v1.iv.tag.ct`) atada a la cuenta y a la
-- conexión, como las claves de IA. Nunca sale de la API.

alter table whatsapp_connections add column if not exists provider_secret text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_connections_secret_check') then
    alter table whatsapp_connections add constraint whatsapp_connections_secret_check
      check (provider_secret is null or provider_secret ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$');
  end if;
end $$;
