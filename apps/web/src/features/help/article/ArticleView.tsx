import "../parts/help-page.css";
import "./article.css";
import { useEffect, useRef, useState } from "react";
import { HELP_MODULES, type ArticleDetail, type ArticleSummary } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { HelpCrumbs } from "../parts/HelpCrumbs";
import { VideoPlayer } from "../tutorials/VideoPlayer";
import { ArticleAside } from "./ArticleAside";
import { ArticleFeedback } from "./ArticleFeedback";
import { ArticleFooter } from "./ArticleFooter";
import { ArticleHeader } from "./ArticleHeader";
import { Markdown } from "./Markdown";
import { useActiveSection } from "./useActiveSection";

type Navigate = (next: Record<string, string>) => void;

/**
 * Un artículo: la ruta, el encabezado, el texto con sus pasos y avisos,
 * «¿Te sirvió?», anterior/siguiente y relacionados; a la derecha el índice
 * que sigue la lectura, su video y los demás artículos del módulo.
 */
export function ArticleView({ slug, onNavigate }: { readonly slug: string; readonly onNavigate: Navigate }) {
  const page = useRef<HTMLDivElement>(null);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [siblings, setSiblings] = useState<ReadonlyArray<ArticleSummary>>([]);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const active = useActiveSection(article?.sections.map((s) => s.id) ?? [], page);

  useEffect(() => {
    setArticle(null);
    setMissing(false);
    page.current?.scrollTo?.({ top: 0 });
    void helpApi.article(slug).then(setArticle).catch(() => setMissing(true));
  }, [slug]);

  const moduleId = article?.module;
  useEffect(() => {
    if (!moduleId) return;
    void helpApi.module(moduleId).then(setSiblings).catch(() => setSiblings([]));
  }, [moduleId]);

  const module = HELP_MODULES.find((m) => m.id === moduleId);
  const toModule = () => module && onNavigate({ module: module.id });
  const toArticle = (next: string) => onNavigate({ article: next });
  const toSection = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  return (
    <div ref={page} className="ui-page help-page help-article">
      <div className="help-page__wrap">
        <HelpCrumbs items={[{ label: "Centro de ayuda", onClick: () => onNavigate({}) }, ...(module ? [{ label: module.name, onClick: toModule }] : []), ...(article ? [{ label: article.title }] : [])]} />
        {missing ? <p className="ui-error" role="alert">Ese artículo no existe o cambió de nombre.</p> : null}
        {!article && !missing ? <div className="help-article__loading" aria-label="Cargando" /> : null}
        {article ? (
          <div className="help-article__layout">
            <article className="help-article__main">
              <ArticleHeader article={article} moduleName={module?.name ?? "Ayuda"} onModule={toModule} />
              <Markdown source={article.body} />
              <ArticleFeedback slug={article.slug} />
              <ArticleFooter slug={article.slug} siblings={siblings} related={article.related} onArticle={toArticle} />
            </article>
            <ArticleAside article={article} active={active} moduleName={module?.name ?? "este módulo"} siblings={siblings} onSection={toSection} onArticle={toArticle} onModule={toModule} onVideo={() => setPlaying(true)} />
          </div>
        ) : null}
      </div>
      {playing && article?.tutorial ? <VideoPlayer tutorial={article.tutorial} onClose={() => setPlaying(false)} /> : null}
    </div>
  );
}
