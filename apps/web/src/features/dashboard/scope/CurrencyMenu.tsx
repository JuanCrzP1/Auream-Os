import "./scope-pop.css";
import { useState } from "react";
import { searchCurrencies } from "./currencyOptions";

/**
 * En qué moneda se ven los montos: cada una con su bandera y su nombre. La
 * que se usa sin elegir (la de la cuenta de anuncios o la más vendida) lo dice.
 */
export function CurrencyMenu({ current, automatic, onChoose }: {
  readonly current: string;
  /** La moneda que se usaría sin elegir ninguna. */
  readonly automatic: string;
  readonly onChoose: (code: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <div className="scope-pop" role="menu" aria-label="Moneda">
      <h4>Ver los montos en</h4>
      <input className="scope-pop__search" type="search" value={query} placeholder="Buscar moneda o país…" aria-label="Buscar moneda o país" onChange={(event) => setQuery(event.target.value)} />
      {searchCurrencies(query).map((option) => (
        <button
          key={option.code}
          type="button"
          role="menuitemradio"
          aria-checked={option.code === current}
          className="scope-option"
          onClick={() => onChoose(option.code === automatic ? null : option.code)}
        >
          <span className="scope-bar__flag" aria-hidden="true">{option.flag}</span>
          <span className="scope-option__body">
            <strong>{option.code}</strong> · {option.name}
            {option.code === automatic ? <small>La de tu negocio</small> : null}
          </span>
          {option.code === current ? <span className="scope-option__check" aria-hidden="true">✓</span> : null}
        </button>
      ))}
      <p className="scope-pop__note">Lo vendido en otras monedas se convierte con la tasa de cada día.</p>
    </div>
  );
}
