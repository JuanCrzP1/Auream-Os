-- Tasas de cambio con su origen: de qué fuente oficial vino cada una (el
-- bolívar, del BCV) y cuándo llegó, para mostrarlo en el Dashboard
-- («1 USD = 904,45 Bs · BCV · actualizada 8:02 p. m.»).
-- Aditiva: las tasas guardadas siguen igual (sin fuente conocida).

alter table fx_rates add column if not exists source text null;
alter table fx_rates add column if not exists fetched_at timestamptz not null default now();
