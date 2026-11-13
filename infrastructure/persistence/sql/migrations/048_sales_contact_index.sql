-- «Con recompras» (Meta Ads): la primera compra de cada cliente y sus compras
-- siguientes se buscan por cliente y fecha. Sin este índice, cada consulta
-- recorrería todas las ventas de la cuenta.
--
-- Aditiva: no toca nada existente.

create index if not exists sales_contact_sold_idx
  on sales (tenant_id, contact_id, sold_at, id)
  where contact_id is not null and status = 'approved';
