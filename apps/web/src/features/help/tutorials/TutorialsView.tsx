import "./tutorials.css";
import { useEffect, useState } from "react";
import { HELP_MODULES, type HelpModuleId, type Tutorial } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { VideoPlayer } from "./VideoPlayer";

/** Tutoriales en video: el destacado, filtros por módulo y cada video (se abre aquí mismo). */
export function TutorialsView({ play, onNavigate }: { readonly play: string | null; readonly onNavigate: (next: Record<string, string>) => void }) {
  const [list, setList] = useState<ReadonlyArray<Tutorial> | null>(null);
  const [module, setModule] = useState<HelpModuleId | "all">("all");
  useEffect(() => {
    void helpApi.tutorials().then(setList).catch(() => setList([]));
  }, []);

  const playing = list?.find((t) => t.id === play) ?? null;
  const featured = list?.find((t) => t.featured) ?? null;
  const modules = HELP_MODULES.filter((m) => list?.some((t) => t.module === m.id));
  const shown = (list ?? []).filter((t) => (module === "all" ? t.id !== featured?.id : t.module === module));
  const open = (id: string) => onNavigate({ view: "videos", play: id });

  return (
    <div className="ui-page help-videos">
      <nav className="help-videos__crumbs" aria-label="Ruta"><button type="button" className="ui-link" onClick={() => onNavigate({})}>Centro de ayuda</button><span>/</span><span>Tutoriales en video</span></nav>
      <header className="ui-page__header"><div><h1 className="ui-page__title">Tutoriales en video</h1><p className="ui-page__subtitle">Aprende cada módulo en pocos minutos, de la mano del equipo de Auream.</p></div></header>
      {list && list.length === 0 ? <p className="ui-muted">Pronto encontrarás aquí los tutoriales en video.</p> : null}
      {modules.length > 1 ? (
        <div className="help-videos__filters" role="tablist" aria-label="Módulo">
          <button type="button" role="tab" aria-selected={module === "all"} onClick={() => setModule("all")}>Todos</button>
          {modules.map((m) => <button key={m.id} type="button" role="tab" aria-selected={module === m.id} onClick={() => setModule(m.id)}>{m.name}</button>)}
        </div>
      ) : null}
      {featured && module === "all" ? (
        <button type="button" className="help-videos__featured" onClick={() => open(featured.id)}>
          <span className="help-videos__thumb help-videos__thumb--big" style={featured.thumbnailUrl ? { backgroundImage: `url(${featured.thumbnailUrl})` } : undefined}><span className="help-videos__play" aria-hidden="true">▶</span>{featured.duration ? <small>{featured.duration}</small> : null}</span>
          <span className="help-videos__featured-text"><span className="help-videos__pill">Empieza por aquí</span><strong>{featured.title}</strong>{featured.description ? <span>{featured.description}</span> : null}</span>
        </button>
      ) : null}
      <div className="help-videos__grid">
        {shown.map((video) => (
          <button key={video.id} type="button" className="help-videos__card" onClick={() => open(video.id)}>
            <span className="help-videos__thumb" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : undefined}>
              <span className="help-videos__play" aria-hidden="true">▶</span>
              {video.duration ? <small>{video.duration}</small> : null}
              {video.seen ? <em>✓ Visto</em> : null}
            </span>
            <span className="help-videos__module">{HELP_MODULES.find((m) => m.id === video.module)?.name}</span>
            <strong>{video.title}</strong>
          </button>
        ))}
      </div>
      {playing ? <VideoPlayer tutorial={playing} onClose={() => onNavigate({ view: "videos" })} /> : null}
    </div>
  );
}
