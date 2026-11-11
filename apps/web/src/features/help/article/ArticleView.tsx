import "./article.css";
import "../home/help-start.css";
import { useEffect, useState } from "react";
import { HELP_MODULES, type ArticleDetail, type SupportSettings } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { formatDate } from "@shared/format/formatDate";
import { SupportBanner } from "../home/SupportBanner";
import { VideoPlayer } from "../tutorials/VideoPlayer";
import { ArticleFeedback } from "./ArticleFeedback";
import { Markdown } from "./Markdown";

type Navigate = (next: Record<string, string>) => void;

/** Un artículo: ruta, título, el texto con sus avisos, el índice, su video, «¿Te sirvió?», relacionados y soporte. */
export function ArticleView({ slug, onNavigate }: { readonly slug: string; readonly onNavigate: Navigate }) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setArticle(null);
    setMissing(false);
    window.scrollTo?.({ top: 0 });
    void helpApi.article(slug).then(setArticle).catch(() => setMissing(true));
    void helpApi.support().then((data) => setSettings(data.settings)).catch(() => undefined);
  }, [slug]);

  const module = article ? HELP_MODULES.find((m) => m.id === article.module) : undefined;
  return (
    <div className="ui-page help-article">
      <nav className="help-article__crumbs" aria-label="Ruta">
        <button type="button" className="ui-link" onClick={() => onNavigate({})}>Centro de ayuda</button>
        {module ? <><span>/</span><button type="button" className="ui-link" onClick={() => onNavigate({ module: module.id })}>{module.name}</button></> : null}
      </nav>
      {missing ? <p className="ui-error" role="alert">Ese artículo no existe.</p> : null}
      {article ? (
        <div className="help-article__layout">
          <article className="help-article__main">
            <header className="help-article__header">
              <h1>{article.title}</h1>
              <span>{article.minutes} min de lectura{article.updated ? ` · Actualizado el ${formatDate(`${article.updated}T12:00:00`)}` : ""}</span>
              {article.summary ? <p>{article.summary}</p> : null}
            </header>
            <Markdown source={article.body} />
            <ArticleFeedback slug={article.slug} />
            {article.related.length > 0 ? (
              <section className="help-article__related" aria-label="También te puede servir">
                <h2>También te puede servir</h2>
                <div>{article.related.map((r) => <button key={r.slug} type="button" onClick={() => onNavigate({ article: r.slug })}>{r.title}</button>)}</div>
              </section>
            ) : null}
            {settings ? <SupportBanner compact settings={settings} onCase={() => onNavigate({ view: "support" })} /> : null}
          </article>
          <aside className="help-article__aside">
            {article.sections.length > 0 ? (
              <nav className="help-article__toc" aria-label="En este artículo">
                <span>En este artículo</span>
                {article.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
              </nav>
            ) : null}
            {article.tutorial ? (
              <button type="button" className="help-article__video" onClick={() => setPlaying(true)}>
                <span className="help-article__thumb" style={article.tutorial.thumbnailUrl ? { backgroundImage: `url(${article.tutorial.thumbnailUrl})` } : undefined}>▶</span>
                <strong>Míralo en video</strong>
                <small>{article.tutorial.title}{article.tutorial.duration ? ` · ${article.tutorial.duration}` : ""}</small>
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
      {playing && article?.tutorial ? <VideoPlayer tutorial={article.tutorial} onClose={() => setPlaying(false)} /> : null}
    </div>
  );
}
