// ---------------------------------------------------------------------------
// «Compró en el grupo»: una venta aprobada de alguien que ESTABA en el grupo
// cuando compró (por su teléfono). Una sola regla para los números del grupo,
// los de la campaña y la lista de miembros: si cambia, cambia en todos.
// ---------------------------------------------------------------------------

/** Las ventas hechas mientras la persona estaba en el grupo `m`. `$1` cuenta, `$3` desde (o `null`). */
export const SALES_OF_MEMBERS = `select m.group_id, s.id as sale_id, s.currency, s.amount, coalesce(c.phone, s.customer_phone) as phone
  from wa_group_members m
  join sales s on s.tenant_id = m.tenant_id and s.status = 'approved' and s.sold_at >= m.joined_at and (m.left_at is null or s.sold_at <= m.left_at)
  left join contacts c on c.tenant_id = s.tenant_id and c.id = s.contact_id
  where m.tenant_id = $1 and m.phone is not null and m.phone = coalesce(c.phone, s.customer_phone)
    and s.amount is not null and s.currency is not null and ($3::timestamptz is null or s.sold_at >= $3)`;
