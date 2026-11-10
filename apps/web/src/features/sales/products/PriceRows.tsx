import { COUNTRIES, CURRENCY_CODES, findCountry } from "@contracts/Countries";
import { SalesIcons } from "../salesIcons";

/** Un precio como lo escribe la persona (el monto es texto hasta guardar). */
export interface PriceDraft {
  readonly key: string;
  readonly country: string;
  readonly currency: string;
  readonly amount: string;
  /** Lo que le cuesta (opcional): da la ganancia real en el Dashboard. */
  readonly cost: string;
}

let next = 0;
export const newPriceRow = (country = "CO"): PriceDraft => ({ key: `price-${++next}`, country, currency: findCountry(country).currency, amount: "", cost: "" });

/**
 * Un precio por país: país, moneda (la del país por defecto, editable: USD en
 * Venezuela), precio y costo (opcional: da la ganancia real). Un país no se repite: los que ya tienen precio no se
 * ofrecen en las otras filas.
 */
export function PriceRows({ rows, onChange }: { readonly rows: ReadonlyArray<PriceDraft>; readonly onChange: (rows: ReadonlyArray<PriceDraft>) => void }) {
  const used = new Set(rows.map((row) => row.country));
  const set = (key: string, patch: Partial<PriceDraft>) =>
    onChange(rows.map((row) => (row.key !== key ? row : { ...row, ...patch, ...(patch.country ? { currency: findCountry(patch.country).currency } : {}) })));
  const free = COUNTRIES.find((country) => !used.has(country.code));

  return (
    <div className="price-rows">
      {rows.map((row, index) => (
        <div key={row.key} className="price-rows__row">
          <select className="ui-input" aria-label={`País del precio ${index + 1}`} value={row.country} onChange={(event) => set(row.key, { country: event.target.value })}>
            {COUNTRIES.filter((country) => country.code === row.country || !used.has(country.code)).map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
          <select className="ui-input" aria-label={`Moneda del precio ${index + 1}`} value={row.currency} onChange={(event) => set(row.key, { currency: event.target.value })}>
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <input
            className="ui-input"
            aria-label={`Precio en ${findCountry(row.country).name}`}
            inputMode="decimal"
            placeholder="49.900"
            value={row.amount}
            onChange={(event) => set(row.key, { amount: event.target.value })}
          />
          <input
            className="ui-input"
            aria-label={`Costo en ${findCountry(row.country).name}`}
            inputMode="decimal"
            placeholder="Costo"
            title="Lo que te cuesta hacerlo o entregarlo (opcional). Con él, el Dashboard muestra la ganancia real."
            value={row.cost}
            onChange={(event) => set(row.key, { cost: event.target.value })}
          />
          <button type="button" className="price-rows__remove" aria-label={`Quitar el precio de ${findCountry(row.country).name}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((other) => other.key !== row.key))}>
            ×
          </button>
        </div>
      ))}
      {free ? (
        <button type="button" className="price-rows__add" onClick={() => onChange([...rows, newPriceRow(free.code)])}>
          {SalesIcons.plus}
          Agregar país
        </button>
      ) : null}
    </div>
  );
}
