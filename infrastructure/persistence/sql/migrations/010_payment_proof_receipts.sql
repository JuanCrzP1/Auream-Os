-- Comprobantes de pago ya aceptados por cada cuenta (bloque «Comprobante
-- automático»), para rechazar los repetidos.
--
-- `fingerprint` identifica el comprobante: `ref:<referencia>` si la trae; si
-- no, un resumen (sha-256) de sus datos. La unicidad por cuenta hace que el
-- registro sea atómico: dos mensajes con el mismo comprobante a la vez → solo
-- uno lo reclama. No se guarda la imagen ni el texto leído.

create table if not exists payment_proof_receipts (
  tenant_id        uuid           not null references tenants (id) on delete cascade,
  fingerprint      text           not null,
  reference        text           null,
  amount           numeric(18, 2) null,
  currency         text           null,
  conversation_key text           not null,
  flow_key         text           not null,
  created_at       timestamptz    not null default now(),
  primary key (tenant_id, fingerprint),
  constraint payment_proof_receipts_fingerprint_check check (length(fingerprint) between 5 and 120),
  constraint payment_proof_receipts_currency_check check (currency is null or currency ~ '^[A-Z]{3}$')
);

create index if not exists payment_proof_receipts_tenant_idx on payment_proof_receipts (tenant_id, created_at desc);
