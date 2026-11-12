import { COUNTRIES, CURRENCY_CODES, findCountry } from "@contracts/Countries";
import type { ProductSummary } from "@contracts/SalesContracts";

/** Lo editable de una venta, como lo escribe la persona. */
export interface SaleFormValue {
  readonly productId: string;
  readonly country: string;
  readonly amount: string;
  readonly currency: string;
  readonly customerName: string;
}

/** Al elegir producto o país: el precio de ese producto en ese país (si lo tiene y el monto está vacío o era el anterior). */
export function withPrice(value: SaleFormValue, products: ReadonlyArray<ProductSummary>, previous: SaleFormValue): SaleFormValue {
  const product = products.find((entry) => entry.id === value.productId);
  const price = product?.prices.find((entry) => entry.country === value.country);
  const previousPrice = products.find((entry) => entry.id === previous.productId)?.prices.find((entry) => entry.country === previous.country);
  const untouched = !value.amount || (previousPrice && value.amount === String(previousPrice.amount));
  if (!price || !untouched) return value;
  return { ...value, amount: String(price.amount), currency: price.currency };
}

/** Producto, país, monto, moneda y cliente. El precio del producto en el país se propone solo. */
export function SaleFields({
  value,
  products,
  onChange,
  idPrefix
}: {
  readonly value: SaleFormValue;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onChange: (next: SaleFormValue) => void;
  readonly idPrefix: string;
}) {
  const set = (patch: Partial<SaleFormValue>) => onChange(withPrice({ ...value, ...patch }, products, value));
  const active = products.filter((product) => product.status === "active" || product.id === value.productId);

  return (
    <div className="sale-fields">
      <div className="ui-field sale-fields__wide">
        <label htmlFor={`${idPrefix}-product`}>Producto</label>
        <select id={`${idPrefix}-product`} className="ui-input" value={value.productId} onChange={(event) => set({ productId: event.target.value })}>
          <option value="">Sin producto (queda por revisar)</option>
          {active.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ui-field">
        <label htmlFor={`${idPrefix}-country`}>País del cliente</label>
        <select id={`${idPrefix}-country`} className="ui-input" value={value.country} onChange={(event) => set({ country: event.target.value })}>
          <option value="">Sin país</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.name}
            </option>
          ))}
        </select>
      </div>
      <div className="ui-field">
        <label htmlFor={`${idPrefix}-amount`}>Monto</label>
        <input id={`${idPrefix}-amount`} className="ui-input" inputMode="decimal" placeholder="49.900" value={value.amount} onChange={(event) => set({ amount: event.target.value })} />
      </div>
      <div className="ui-field">
        <label htmlFor={`${idPrefix}-currency`}>Moneda</label>
        <select id={`${idPrefix}-currency`} className="ui-input" value={value.currency} onChange={(event) => set({ currency: event.target.value })}>
          <option value="">Elige…</option>
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <div className="ui-field">
        <label htmlFor={`${idPrefix}-customer`}>Nombre del cliente</label>
        <input id={`${idPrefix}-customer`} className="ui-input" maxLength={120} value={value.customerName} onChange={(event) => set({ customerName: event.target.value })} />
      </div>
      {value.country && !value.currency ? <p className="ui-muted sale-fields__wide">La moneda de {findCountry(value.country).name} es {findCountry(value.country).currency}.</p> : null}
    </div>
  );
}
