import "./article-footer.css";
import { HELP_MODULES, type ArticleSummary } from "@contracts/HelpContracts";
import { HelpIcon } from "@shared/help/HelpIcons";

interface Props {
  readonly slug: string;
  readonly siblings: ReadonlyArray<ArticleSummary>;
  readonly related: ReadonlyArray<ArticleSummary>;
  readonly onArticle: (slug: string) => void;
}

/** Debajo del artículo: el anterior y el siguiente del módulo, y lo que también te puede servir. */
export function ArticleFooter({ slug, siblings, related, onArticle }: Props) {
  const index = siblings.findIndex((item) => item.slug === slug);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const extra = related.filter((item) => item.slug !== previous?.slug && item.slug !== next?.slug).slice(0, 3);

  return (
    <>
      {previous || next ? (
        <nav className="help-pager" aria-label="Seguir leyendo">
          {previous ? (
            <button type="button" className="help-pager__item" onClick={() => onArticle(previous.slug)}>
              <small><HelpIcon name="arrowLeft" size={14} />Anterior</small>
              <strong>{previous.title}</strong>
            </button>
          ) : <span />}
          {next ? (
            <button type="button" className="help-pager__item help-pager__item--next" onClick={() => onArticle(next.slug)}>
              <small>Siguiente<HelpIcon name="arrowRight" size={14} /></small>
              <strong>{next.title}</strong>
            </button>
          ) : null}
        </nav>
      ) : null}

      {extra.length > 0 ? (
        <section className="help-related" aria-label="También te puede servir">
          <h2>También te puede servir</h2>
          <div>
            {extra.map((item) => (
              <button key={item.slug} type="button" onClick={() => onArticle(item.slug)}>
                <small>{HELP_MODULES.find((m) => m.id === item.module)?.name}</small>
                <strong>{item.title}</strong>
                <span><HelpIcon name="clock" size={13} />{item.minutes} min</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
