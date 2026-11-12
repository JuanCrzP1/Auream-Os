-- Quiénes entran solos a un embudo (CRM): todos los que escriben y aún no
-- están en él (`all`, como espera un CRM de WhatsApp) o solo los que llegaron
-- por un anuncio (`ads`). «Nadie» sigue siendo no tener etapa de entrada.
-- Aditiva: los embudos que ya existen quedan en `all`.

alter table crm_pipelines add column if not exists entry_source text not null default 'all';
alter table crm_pipelines drop constraint if exists crm_pipelines_entry_source_check;
alter table crm_pipelines add constraint crm_pipelines_entry_source_check check (entry_source in ('all', 'ads'));
