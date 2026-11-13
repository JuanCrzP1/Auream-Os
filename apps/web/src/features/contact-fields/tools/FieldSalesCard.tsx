import "./field-tools.css";
import { useEffect, useState } from "react";
import type { FieldSalesResponse } from "@contracts/ContactFieldToolsContracts";
import { fetchFieldSales } from "@shared/contact-fields/contactFieldsApi";

const DAYS = [7, 30, 90] as const;
const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CO")} ${currency}`;
  }
};

/**
 * «Lo que vende cada valor»: las ventas aprobadas de los clientes de cada
 * valor del campo, sin mezclar monedas. Si quien mira no ve ventas, o aún no
 * hay, no se muestra nada.
 */
export function FieldSalesCard({ fieldId, label }: { readonly fieldId: string; readonly label: string }) {
  const [days, setDays] = useState<(typeof DAYS)[number]>(30);
  const [data, setData] = useState<FieldSalesResponse | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFieldSales(fieldId, days).then((result) => alive && setData(result), () => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [fieldId, days]);

  // Solo las monedas donde algún valor vendió: «todo sin dato» no dice nada del campo.
  const currencies = (data?.currencies ?? []).filter((entry) => entry.values.some((value) => value.value !== null));
  if (currencies.length === 0) return null;
  const shown = currencies.find((entry) => entry.currency === currency) ?? currencies[0]!;
  const percent = (amount: number) => (shown.total > 0 ? Math.round((amount / shown.total) * 100) : 0);

  return (
    <section className="ft-sales" aria-label={`Lo que vende cada valor de ${label}`}>
      <div className="ft-sales__head">
        <span>
          <span className="ft-sales__eyebrow">Lo que vende cada valor</span>
          <strong>{money(shown.total, shown.currency)}</strong>
        </span>
        <span className="ft-sales__controls">
          <select aria-label="Periodo" value={days} onChange={(event) => setDays(Number(event.target.value) as (typeof DAYS)[number])}>
            {DAYS.map((option) => <option key={option} value={option}>Últimos {option} días</option>)}
          </select>
          {currencies.length > 1 ? (
            <select aria-label="Moneda" value={shown.currency} onChange={(event) => setCurrency(event.target.value)}>
              {currencies.map((entry) => <option key={entry.currency} value={entry.currency}>{entry.currency}</option>)}
            </select>
          ) : <span>{shown.currency}</span>}
        </span>
      </div>
      <ul className="ft-sales__rows">
        {shown.values.map((entry) => (
          <li key={entry.value ?? "sin-dato"}>
            <span className="ft-sales__name">{entry.value ?? "Sin dato"}</span>
            <span className="ft-sales__bar" aria-hidden="true"><span style={{ width: `${percent(entry.amount)}%` }} /></span>
            <span className="ft-sales__amount">{money(entry.amount, shown.currency)} · {percent(entry.amount)} %</span>
          </li>
        ))}
      </ul>
      <span className="ft-sales__foot">Ventas aprobadas de los clientes con cada valor.</span>
    </section>
  );
}
