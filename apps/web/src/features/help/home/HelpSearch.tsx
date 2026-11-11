import { useState } from "react";
import type { ArticleSummary } from "@contracts/HelpContracts";
import { useHelpSearch } from "@shared/help/useHelpSearch";

/** El buscador grande de la portada, con resultados mientras se escribe. */
export function HelpSearch({ onOpen, popular }: { readonly onOpen: (slug: string) => void; readonly popular: ReadonlyArray<ArticleSummary> }) {
  const [query, setQuery] = useState("");
  const results = useHelpSearch(query);

  return (
    <section className="help-search" aria-label="Buscar en la ayuda">
      <span className="help-search__pill">Centro de ayuda</span>
      <h1>¿En qué te ayudamos?</h1>
      <div className="help-search__box">
        <label className="help-search__field">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={query} placeholder="Busca: conectar mi número, programar un mensaje, ROAS…" aria-label="Buscar en la ayuda" onChange={(event) => setQuery(event.target.value)} />
        </label>
        {results ? (
          <div className="help-search__results" role="listbox" aria-label="Resultados">
            {results.length === 0 ? <span className="help-search__empty">No encontramos nada con eso. Prueba con otras palabras.</span> : null}
            {results.map((article) => (
              <button key={article.slug} type="button" role="option" aria-selected="false" onClick={() => onOpen(article.slug)}>
                <strong>{article.title}</strong><span>{article.summary}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {popular.length > 0 ? (
        <div className="help-search__popular">
          <span>Lo más buscado:</span>
          {popular.map((article) => <button key={article.slug} type="button" onClick={() => onOpen(article.slug)}>{article.title}</button>)}
        </div>
      ) : null}
    </section>
  );
}
