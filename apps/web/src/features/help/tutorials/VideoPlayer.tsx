import "./tutorials.css";
import { useEffect } from "react";
import type { Tutorial } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";

/** El video en grande, dentro de Auream (YouTube sin cookies o Vimeo). Queda marcado como visto. */
export function VideoPlayer({ tutorial, onClose }: { readonly tutorial: Tutorial; readonly onClose: () => void }) {
  useEffect(() => {
    void helpApi.seen(tutorial.id).catch(() => undefined);
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [tutorial.id, onClose]);

  return (
    <div className="help-player" role="dialog" aria-modal="true" aria-label={tutorial.title} onClick={onClose}>
      <div className="help-player__box" onClick={(event) => event.stopPropagation()}>
        <div className="help-player__head">
          <strong>{tutorial.title}</strong>
          <button type="button" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="help-player__frame">
          <iframe src={tutorial.embedUrl} title={tutorial.title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
        {tutorial.description ? <p>{tutorial.description}</p> : null}
      </div>
    </div>
  );
}
