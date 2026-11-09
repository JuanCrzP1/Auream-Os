-- El anuncio de clic a WhatsApp por el que entró cada contacto (como las
-- columnas «Anúncio» de Leona): id y enlace del anuncio, su publicación, su
-- miniatura y el código de clic de Meta (`ctwa_clid`). Uso interno: variables
-- (`{source_url}`…), Notificación y Pixel (atribuir la compra al anuncio).
-- El último anuncio reemplaza al anterior. Aditiva: la versión que sirve sigue igual.

alter table contacts add column if not exists ad_origin jsonb null;

alter table contacts drop constraint if exists contacts_ad_origin_check;
alter table contacts add constraint contacts_ad_origin_check
  check (ad_origin is null or jsonb_typeof(ad_origin) = 'object');
