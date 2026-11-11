import "../parts/help-page.css";
import "./help-home.css";
import "./help-home-parts.css";
import "./help-start.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HelpHomeResponse } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { HelpSearch } from "./HelpSearch";
import { StartChecklist } from "./StartChecklist";
import { SupportBanner } from "./SupportBanner";

type Navigate = (next: Record<string, string>) => void;

/** La portada: buscar, empezar, cada módulo, lo más leído, novedades, tutoriales y cómo contactar al equipo. */
export function HelpHome({ onNavigate }: { readonly onNavigate: Navigate }) {
  const [data, setData] = useState<HelpHomeResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void helpApi.home().then(setData).catch(() => setFailed(true));
  }, []);

  return (
    <div className="ui-page help-page">
      <div className="help-page__wrap help-home">
      <HelpSearch onOpen={(slug) => onNavigate({ article: slug })} popular={data?.popular.slice(0, 4) ?? []} />
      {failed ? <p className="ui-error" role="alert">No pudimos cargar la ayuda. Revisa tu conexión.</p> : null}
      {data?.canManage ? (
        <button type="button" className="help-home__admin" onClick={() => onNavigate({ view: "admin" })}>Administrar ayuda →</button>
      ) : null}
      {data ? <StartChecklist steps={data.onboarding} /> : null}

      {data ? (
        <section className="help-home__section" aria-label="Ayuda por módulo">
          <h2>Ayuda por módulo</h2>
          <div className="help-home__modules">
            {data.modules.map((module, index) => (
              <button key={module.id} type="button" className="help-home__module" onClick={() => onNavigate({ module: module.id })}>
                <span className={`help-home__icon help-home__icon--${index % 5}`} aria-hidden="true">{module.name.slice(0, 2).toUpperCase()}</span>
                <span className="help-home__module-text">
                  <strong>{module.name}</strong>
                  <span>{module.description}</span>
                  <small>{module.articles} {module.articles === 1 ? "artículo" : "artículos"}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {data && data.tutorials.length > 0 ? (
        <section className="help-home__section" aria-label="Tutoriales en video">
          <div className="help-home__row-head"><h2>Tutoriales en video</h2><button type="button" className="ui-link" onClick={() => onNavigate({ view: "videos" })}>Ver todos →</button></div>
          <div className="help-home__videos">
            {data.tutorials.slice(0, 4).map((video) => (
              <button key={video.id} type="button" className="help-home__video" onClick={() => onNavigate({ view: "videos", play: video.id })}>
                <span className="help-home__thumb" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : undefined}><span aria-hidden="true">▶</span>{video.duration ? <small>{video.duration}</small> : null}</span>
                <strong>{video.title}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {data ? (
        <div className="help-home__columns">
          <section className="help-home__panel" aria-label="Lo más leído">
            <h2>Lo más leído</h2>
            {data.popular.map((article) => (
              <Link key={article.slug} className="help-home__link" to={`/help?article=${article.slug}`}>
                <span><strong>{article.title}</strong><small>{article.minutes} min de lectura</small></span><span aria-hidden="true">→</span>
              </Link>
            ))}
          </section>
          <section className="help-home__panel" aria-label="Novedades">
            <h2>Novedades</h2>
            {data.news.map((article) => (
              <Link key={article.slug} className="help-home__news" to={`/help?article=${article.slug}`}>
                <small>{article.title.split(":")[0]}</small><strong>{article.title.split(":").slice(1).join(":").trim() || article.title}</strong>
              </Link>
            ))}
          </section>
        </div>
      ) : null}

      {data ? <SupportBanner settings={data.support} /> : null}
      </div>
    </div>
  );
}
