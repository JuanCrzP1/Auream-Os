import "./help-panel.css";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HELP_MODULES, type ArticleSummary, type SupportCase, type SupportSettings, type Tutorial } from "@contracts/HelpContracts";
import { helpApi } from "./helpApi";
import { moduleForPath } from "./moduleForPath";
import { SupportForm } from "./SupportForm";

/**
 * El botón «?» de cada pantalla y su panel: la ayuda de ESA pantalla (sus
 * artículos y su video) y hablar con soporte. Se carga al abrirlo.
 */
export function HelpPanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"help" | "support">("help");
  const [articles, setArticles] = useState<ReadonlyArray<ArticleSummary>>([]);
  const [video, setVideo] = useState<Tutorial | null>(null);
  const [support, setSupport] = useState<{ settings: SupportSettings | null; cases: ReadonlyArray<SupportCase> }>({ settings: null, cases: [] });
  const moduleId = moduleForPath(location.pathname);
  const module = HELP_MODULES.find((m) => m.id === moduleId)!;

  useEffect(() => {
    if (!open) return;
    void helpApi.module(moduleId).then(setArticles).catch(() => setArticles([]));
    void helpApi.tutorials().then((list) => setVideo(list.find((t) => t.module === moduleId) ?? null)).catch(() => setVideo(null));
    void helpApi.support().then(setSupport).catch(() => undefined);
  }, [open, moduleId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  if (location.pathname.startsWith("/help")) return null;
  return (
    <>
      <button type="button" className="help-fab" aria-label="Ayuda y soporte" aria-expanded={open} onClick={() => setOpen(!open)}>?</button>
      {open ? (
        <div className="help-panel__backdrop" onClick={() => setOpen(false)} role="presentation">
          <aside className="help-panel" aria-label="Ayuda y soporte" onClick={(event) => event.stopPropagation()}>
            <header className="help-panel__head">
              <div className="help-panel__title">
                <strong>Ayuda</strong>
                <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>✕</button>
              </div>
              <div className="help-panel__tabs" role="tablist" aria-label="Ver">
                <button type="button" role="tab" aria-selected={tab === "help"} onClick={() => setTab("help")}>Ayuda</button>
                <button type="button" role="tab" aria-selected={tab === "support"} onClick={() => setTab("support")}>Hablar con soporte</button>
              </div>
            </header>
            <div className="help-panel__body">
              {tab === "help" ? (
                <>
                  <span className="help-panel__label">Para esta pantalla · {module.name}</span>
                  {articles.slice(0, 5).map((article) => (
                    <Link key={article.slug} className="help-panel__article" to={`/help?article=${article.slug}`} onClick={() => setOpen(false)}>
                      <span>{article.title}</span><span aria-hidden="true">→</span>
                    </Link>
                  ))}
                  {video ? (
                    <Link className="help-panel__video" to={`/help?view=videos&play=${video.id}`} onClick={() => setOpen(false)}>
                      <span className="help-panel__thumb" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : undefined}>▶</span>
                      <span><strong>{video.title}</strong><small>{video.duration ? `${video.duration} · ` : ""}Video</small></span>
                    </Link>
                  ) : null}
                  <Link className="help-panel__all" to={`/help?module=${moduleId}`} onClick={() => setOpen(false)}>Ver toda la ayuda de {module.name} →</Link>
                  <Link className="help-panel__all" to="/help" onClick={() => setOpen(false)}>Abrir el Centro de ayuda →</Link>
                </>
              ) : (
                <SupportForm settings={support.settings} cases={support.cases} page={location.pathname} onCases={(cases) => setSupport((current) => ({ ...current, cases }))} />
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
