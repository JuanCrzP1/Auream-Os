import "./legal.css";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AureamLogo } from "@shared/brand/AureamLogo";
import { Markdown } from "@shared/markdown/Markdown";
import { ThemeToggleButton } from "@shared/theme/components/ThemeToggleButton";
import { DeletionStatus } from "./DeletionStatus";
import { LEGAL_DOCS, legalDoc, type LegalDocId } from "./legalDocs";
import { fillLegal, LEGAL_OWNER } from "./legalOwner";

/**
 * Una página legal pública (privacidad, términos o eliminación de datos), sin
 * sesión y con la marca de Auream. En la de eliminación, si llega `?codigo=`
 * (Meta manda ahí a quien pidió borrar sus datos), muestra cómo quedó.
 */
export function LegalPage({ id }: { readonly id: LegalDocId }) {
  const doc = legalDoc(id);
  const [params] = useSearchParams();
  const code = id === "deletion" ? params.get("codigo")?.trim().slice(0, 32) : undefined;

  useEffect(() => {
    document.title = `${doc.title} · Auream`;
    window.scrollTo(0, 0);
  }, [doc.title]);

  return (
    <div className="legal-page">
      <header className="legal-page__bar">
        <Link to="/login" aria-label="Auream, ir al inicio">
          <AureamLogo width={120} />
        </Link>
        <div className="legal-page__bar-actions">
          <ThemeToggleButton />
          <Link className="ui-btn ui-btn--ghost" to="/login">Iniciar sesión</Link>
        </div>
      </header>

      <main className="legal-page__main">
        <nav className="legal-page__tabs" aria-label="Documentos legales">
          {LEGAL_DOCS.map((item) => (
            <Link key={item.id} to={item.path} aria-current={item.id === id ? "page" : undefined} className={item.id === id ? "is-current" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <article className="legal-page__doc">
          <h1>{doc.title}</h1>
          <p className="legal-page__date">Vigente desde el {LEGAL_OWNER.effectiveDate}</p>
          {code ? <DeletionStatus code={code} /> : null}
          <Markdown source={fillLegal(doc.source)} />
        </article>
      </main>

      <footer className="legal-page__footer">
        <span>© {new Date().getFullYear()} Auream</span>
        {LEGAL_DOCS.map((item) => (
          <Link key={item.id} to={item.path}>{item.label}</Link>
        ))}
        <a href={`mailto:${LEGAL_OWNER.email}`}>{LEGAL_OWNER.email}</a>
      </footer>
    </div>
  );
}
