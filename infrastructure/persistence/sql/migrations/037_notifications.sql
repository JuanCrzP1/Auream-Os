-- Notificaciones (la campana del menú).
--
--   notification_reads   hasta cuándo vio cada persona sus avisos (el número
--                        rojo cuenta lo que pasó después)
--
-- Los avisos no se guardan: se leen del estado de cada módulo (números,
-- difusiones, ventas, seguimientos, grupos) y desaparecen cuando se resuelven.
-- Aditiva: no toca nada existente.

create table if not exists notification_reads (
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  user_id    uuid        not null,
  seen_at    timestamptz not null,
  primary key (tenant_id, user_id)
);
