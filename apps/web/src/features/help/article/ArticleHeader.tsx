import { useEffect, useState } from "react";
import type { ArticleDetail } from "@contracts/HelpContracts";
import { formatDate } from "@shared/format/formatDate";
import { HelpIcon } from "@shared/help/HelpIcons";

/** Arriba del artículo: el módulo, el título, de qué trata, cuánto toma leerlo, cuándo se actualizó y copiar el enlace. */
export function ArticleHeader({ article, moduleName, onModule }: { readonly article: ArticleDetail; readonly moduleName: string; readonly onModule: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    const url = `${window.location.origin}/help?article=${article.slug}`;
    void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => undefined);
  };

  return (
    <header className="help-article__header">
      <button type="button" className="help-article__module" onClick={onModule}>
        <span aria-hidden="true" />{moduleName}
      </button>
      <h1>{article.title}</h1>
      {article.summary ? <p className="help-article__lead">{article.summary}</p> : null}
      <div className="help-article__meta">
        <span><HelpIcon name="clock" size={15} />{article.minutes} min de lectura</span>
        {article.updated ? <span><HelpIcon name="calendar" size={15} />Actualizado el {formatDate(`${article.updated}T12:00:00`)}</span> : null}
        <button type="button" className="help-article__copy" onClick={copy} aria-live="polite">
          <HelpIcon name={copied ? "check" : "link"} size={15} />{copied ? "Enlace copiado" : "Copiar enlace"}
        </button>
      </div>
    </header>
  );
}
