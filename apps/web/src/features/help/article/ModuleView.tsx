import "./article.css";
import { useEffect, useState } from "react";
import { HELP_MODULES, type ArticleSummary } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";

/** Los artículos de un módulo, en orden. */
export function ModuleView({ moduleId, onNavigate }: { readonly moduleId: string; readonly onNavigate: (next: Record<string, string>) => void }) {
  const [articles, setArticles] = useState<ReadonlyArray<ArticleSummary> | null>(null);
  const module = HELP_MODULES.find((m) => m.id === moduleId);
  useEffect(() => {
    void helpApi.module(moduleId).then(setArticles).catch(() => setArticles([]));
  }, [moduleId]);
  return (
    <div className="ui-page help-article">
      <nav className="help-article__crumbs" aria-label="Ruta"><button type="button" className="ui-link" onClick={() => onNavigate({})}>Centro de ayuda</button><span>/</span><span>{module?.name ?? "Módulo"}</span></nav>
      <header className="ui-page__header"><div><h1 className="ui-page__title">{module?.name ?? "Ayuda"}</h1><p className="ui-page__subtitle">{module?.description}</p></div></header>
      <div className="help-module">
        {articles?.map((article, index) => (
          <button key={article.slug} type="button" className="help-module__item" onClick={() => onNavigate({ article: article.slug })}>
            <span className="help-module__num">{index + 1}</span>
            <span><strong>{article.title}</strong><small>{article.summary}</small></span>
            <span className="help-module__time">{article.minutes} min</span>
          </button>
        ))}
        {articles && articles.length === 0 ? <p className="ui-muted">Aún no hay artículos en este módulo.</p> : null}
      </div>
    </div>
  );
}
