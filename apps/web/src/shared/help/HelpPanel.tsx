import "./help-panel.css";
import "./help-panel-items.css";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HELP_MODULES, type ArticleSummary, type Tutorial } from "@contracts/HelpContracts";
import { helpApi } from "./helpApi";
import { HelpIcon } from "./HelpIcons";
import { onOpenHelpPanel } from "./helpPanelEvents";
import { moduleForPath } from "./moduleForPath";
import { useHelpSearch } from "./useHelpSearch";

/**
 * El panel de ayuda de cada pantalla: buscar en la ayuda y, sin búsqueda, los
 * artículos y el video de ESA pantalla. Se abre desde la diadema de soporte
 * («Ayuda de esta pantalla», `openHelpPanel`); sin botón flotante que tape
 * la pantalla. Se carga al abrirlo.
 */
export function HelpPanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<ReadonlyArray<ArticleSummary> | null>(null);
  const [video, setVideo] = useState<Tutorial | null>(null);
  const results = useHelpSearch(query);
  const moduleId = moduleForPath(location.pathname);
  const module = HELP_MODULES.find((m) => m.id === moduleId)!;

  useEffect(() => {
    if (!open) return;
    void helpApi.module(moduleId).then(setArticles).catch(() => setArticles([]));
    void helpApi.tutorials().then((list) => setVideo(list.find((t) => t.module === moduleId) ?? null)).catch(() => setVideo(null));
  }, [open, moduleId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  useEffect(() => setQuery(""), [open]);
  useEffect(() => onOpenHelpPanel(() => setOpen(true)), []);

  if (location.pathname.startsWith("/help")) return null;
  const close = () => setOpen(false);
  const list = results ?? articles?.slice(0, 6) ?? [];

  return (
    <>
      {open ? (
        <div className="help-panel__backdrop" onClick={close} role="presentation">
          <aside className="help-panel" aria-label="Ayuda" onClick={(event) => event.stopPropagation()}>
            <header className="help-panel__head">
              <div className="help-panel__title">
                <span><strong>Ayuda</strong><small>Estás en {module.name}</small></span>
                <button type="button" aria-label="Cerrar" onClick={close}><HelpIcon name="close" size={18} /></button>
              </div>
              <label className="help-panel__search">
                <HelpIcon name="search" size={17} />
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input type="search" autoFocus value={query} placeholder="Busca en la ayuda" aria-label="Buscar en la ayuda" onChange={(event) => setQuery(event.target.value)} />
              </label>
            </header>

            <div className="help-panel__body">
              <section className="help-panel__group" aria-label={results ? "Resultados" : `Para esta pantalla · ${module.name}`}>
                <span className="help-panel__label">{results ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"}` : `Para esta pantalla · ${module.name}`}</span>
                {results && results.length === 0 ? <p className="help-panel__empty">No encontramos nada con «{query.trim()}». Prueba con otras palabras.</p> : null}
                {articles === null && !results ? <span className="help-panel__loading" aria-label="Cargando" /> : null}
                {list.map((article) => (
                  <Link key={article.slug} className="help-panel__article" to={`/help?article=${article.slug}`} onClick={close}>
                    <span className="help-panel__doc"><HelpIcon name="doc" size={17} /></span>
                    <span className="help-panel__text"><strong>{article.title}</strong><small>{article.summary}</small></span>
                    <span className="help-panel__go" aria-hidden="true"><HelpIcon name="chevron" size={16} /></span>
                  </Link>
                ))}
              </section>

              {video && !results ? (
                <Link className="help-panel__video" to={`/help?view=videos&play=${video.id}`} onClick={close}>
                  <span className="help-panel__thumb" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : undefined}><HelpIcon name="play" size={16} /></span>
                  <span className="help-panel__text"><strong>{video.title}</strong><small>Video{video.duration ? ` · ${video.duration}` : ""}</small></span>
                </Link>
              ) : null}

              <nav className="help-panel__links" aria-label="Más ayuda">
                <Link to={`/help?module=${moduleId}`} onClick={close}><HelpIcon name="list" />Toda la ayuda de {module.name}</Link>
                <Link to="/help?view=videos" onClick={close}><HelpIcon name="video" />Tutoriales en video</Link>
                <Link to="/help" onClick={close}><HelpIcon name="book" />Centro de ayuda</Link>
              </nav>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
