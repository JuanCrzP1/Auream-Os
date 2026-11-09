-- Fotos de perfil de WhatsApp (como en Leona): la del número conectado y la de
-- cada contacto. Son ENLACES TEMPORALES del proveedor: se guardan para
-- mostrarlos y se renuevan solos (al consultar la conexión; al escribir el
-- contacto, si la última revisión es vieja). Si un enlace vence, la pantalla
-- muestra las iniciales. Aditiva.

alter table whatsapp_connections add column if not exists profile_picture_url text null;

alter table contacts add column if not exists avatar_url text null;
alter table contacts add column if not exists avatar_checked_at timestamptz null;
