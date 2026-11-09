-- Eliminar un número no borra su historial. La conexión queda marcada como
-- eliminada (desconectada y sin credencial), deja de existir para la cuenta
-- (pantalla Conexiones, avisos del proveedor, envíos) y sus chats siguen en
-- la bandeja para leerlos. Sus disparadores sí se borran.
--
-- Un número eliminado no ocupa su nombre: se puede crear otro igual.

alter table whatsapp_connections add column if not exists deleted_at timestamptz null;

drop index if exists whatsapp_connections_tenant_name_unique;

create unique index if not exists whatsapp_connections_tenant_name_live_unique
  on whatsapp_connections (tenant_id, lower(name))
  where deleted_at is null;
