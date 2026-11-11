import "../parts/help-page.css";
import "./module.css";
import { useEffect, useState } from "react";
import { HELP_MODULES, type ArticleSummary } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { HelpIcon } from "@shared/help/HelpIcons";
import { HelpCrumbs } from "../parts/HelpCrumbs";

/** Los artículos de un módulo, en el orden en que conviene leerlos. */
export function ModuleView({ moduleId, onNavigate }: { readonly moduleId: string; readonly onNavigate: (next: Record<string, string>) => void }) {
  const [articles, setArticles] = useState<ReadonlyArray<ArticleSummary> | null>(null);
  const module = HELP_MODULES.find((m) => m.id === moduleId);
  useEffect(() => {
    void helpApi.module(moduleId).then(setArticles).catch(() => setArticles([]));
  }, [moduleId]);
  const minutes = (articles ?? []).reduce((sum, a) => sum + a.minutes, 0);

  return (
    <div className="ui-page help-page help-module">
      <div className="help-page__wrap">
        <HelpCrumbs items={[{ label: "Centro de ayuda", onClick: () => onNavigate({}) }, { label: module?.name ?? "Módulo" }]} />
        <header className="help-module__header">
          <span className="help-module__badge" aria-hidden="true"><HelpIcon name="book" size={22} /></span>
          <div>
            <h1>{module?.name ?? "Ayuda"}</h1>
            <p>{module?.description}</p>
            {articles && articles.length > 0 ? <small>{articles.length} {articles.length === 1 ? "artículo" : "artículos"} · {minutes} min de lectura en total</small> : null}
          </div>
        </header>
        <ol className="help-module__list">
          {articles?.map((article, index) => (
            <li key={article.slug}>
              <button type="button" className="help-module__item" onClick={() => onNavigate({ article: article.slug })}>
                <span className="help-module__num">{index + 1}</span>
                <span className="help-module__text"><strong>{article.title}</strong><span>{article.summary}</span></span>
                <span className="help-module__time"><HelpIcon name="clock" size={14} />{article.minutes} min</span>
                <span className="help-module__go" aria-hidden="true"><HelpIcon name="arrowRight" size={16} /></span>
              </button>
            </li>
          ))}
        </ol>
        {articles && articles.length === 0 ? <p className="ui-muted">Aún no hay artículos en este módulo.</p> : null}
      </div>
    </div>
  );
}
