-- «Ir a otro flujo»: un turno puede empezar porque otro flujo pasó al cliente
-- a este (origen `handoff`) en el historial interno de turnos. Aditiva.

alter table flow_turn_log drop constraint if exists flow_turn_log_origin_check;
alter table flow_turn_log add constraint flow_turn_log_origin_check check (origin in ('message', 'timer', 'manual', 'handoff'));
