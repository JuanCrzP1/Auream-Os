-- Un negocio por cada compra (CRM). Antes había un registro por cliente y
-- embudo; ahora cada compra es un registro propio:
--
--   id            la compra
--   number        1.ª, 2.ª, 3.ª… compra del cliente en ese embudo
--   current       la compra actual (la que mueven las etiquetas, los flujos y
--                 las ventas). Una sola por cliente y embudo.
--   sale_id       la venta aprobada que la cerró (Ventas)
--   ad_source_id  el anuncio por el que llegó al abrirse (Meta)
--
-- Los registros que ya existen quedan como la compra n.º 1, actual. No se
-- borra nada.

alter table crm_deals add column if not exists id uuid not null default gen_random_uuid();
alter table crm_deals add column if not exists number integer not null default 1;
alter table crm_deals add column if not exists current boolean not null default true;
alter table crm_deals add column if not exists sale_id uuid null;
alter table crm_deals add column if not exists ad_source_id text null;

alter table crm_deals drop constraint if exists crm_deals_pkey;
alter table crm_deals add constraint crm_deals_pkey primary key (id);
alter table crm_deals drop constraint if exists crm_deals_number_check;
alter table crm_deals add constraint crm_deals_number_check check (number >= 1);

-- Una sola compra actual por cliente y embudo, y números que no se repiten.
create unique index if not exists crm_deals_current_idx on crm_deals (pipeline_id, contact_id) where current;
create unique index if not exists crm_deals_number_idx on crm_deals (pipeline_id, contact_id, number);

-- La compra n.º 1 de quien llegó por un anuncio queda con ese anuncio.
update crm_deals d
   set ad_source_id = c.ad_origin ->> 'sourceId'
  from contacts c
 where c.tenant_id = d.tenant_id and c.id = d.contact_id and d.ad_source_id is null and c.ad_origin ->> 'sourceId' is not null;
