import "./article-aside.css";
import type { ArticleDetail, ArticleSummary } from "@contracts/HelpContracts";
import { HelpIcon } from "@shared/help/HelpIcons";

interface Props {
  readonly article: ArticleDetail;
  readonly active: string | null;
  readonly moduleName: string;
  readonly siblings: ReadonlyArray<ArticleSummary>;
  readonly onSection: (id: string) => void;
  readonly onArticle: (slug: string) => void;
  readonly onModule: () => void;
  readonly onVideo: () => void;
}

/** La columna de la derecha: el índice que sigue la lectura, el video y los demás artículos del módulo. */
export function ArticleAside({ article, active, moduleName, siblings, onSection, onArticle, onModule, onVideo }: Props) {
  return (
    <aside className="help-aside">
      {article.sections.length > 0 ? (
        <nav className="help-aside__card help-aside__toc" aria-label="En este artículo">
          <span className="help-aside__label"><HelpIcon name="list" size={14} />En este artículo</span>
          <ol>
            {article.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined} onClick={(event) => { event.preventDefault(); onSection(section.id); }}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {article.tutorial ? (
        <button type="button" className="help-aside__card help-aside__video" onClick={onVideo}>
          <span className="help-aside__thumb" style={article.tutorial.thumbnailUrl ? { backgroundImage: `url(${article.tutorial.thumbnailUrl})` } : undefined}>
            <span className="help-aside__play"><HelpIcon name="play" size={16} /></span>
            {article.tutorial.duration ? <small>{article.tutorial.duration}</small> : null}
          </span>
          <span className="help-aside__label"><HelpIcon name="video" size={14} />Míralo en video</span>
          <strong>{article.tutorial.title}</strong>
        </button>
      ) : null}

      {siblings.length > 1 ? (
        <section className="help-aside__card help-aside__more" aria-label={`Más de ${moduleName}`}>
          <span className="help-aside__label"><HelpIcon name="book" size={14} />Más de {moduleName}</span>
          <ul>
            {siblings.slice(0, 7).map((item) => (
              <li key={item.slug}>
                {item.slug === article.slug ? (
                  <span className="help-aside__here" aria-current="page"><HelpIcon name="doc" size={15} />{item.title}</span>
                ) : (
                  <button type="button" onClick={() => onArticle(item.slug)}><HelpIcon name="doc" size={15} />{item.title}</button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="help-aside__all" onClick={onModule}>
            Ver los {siblings.length} artículos<HelpIcon name="arrowRight" size={14} />
          </button>
        </section>
      ) : null}
    </aside>
  );
}
