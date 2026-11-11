import { HELP_MODULES, type ArticleDetail, type ArticleSummary, type HelpHomeResponse, type Tutorial } from "../../../contracts/HelpContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { searchArticles, sectionsOf, toSummary, type Article } from "../domain/Article";
import type { ArticleLibrary, FeedbackRepository, OnboardingProbe, SupportRepository } from "./HelpPorts";
import type { TutorialServices } from "./TutorialServices";

// ---------------------------------------------------------------------------
// El centro de ayuda: la portada (módulos, lo más leído, novedades, «Empieza
// aquí», tutoriales y cómo contactar a soporte), cada artículo, la búsqueda y
// «¿Te sirvió?». También da los artículos a los agentes (MCP) y a `llms.txt`.
// ---------------------------------------------------------------------------

export interface HelpViewer {
  readonly tenantId: string;
  readonly userId: string;
  /** Equipo de Auream: administra tutoriales y soporte. */
  readonly canManage: boolean;
}

/** Los más leídos (por ahora, los que más ayudan a empezar). */
const POPULAR = ["conectar-whatsapp-qr", "numero-desconectado", "primer-flujo", "registrar-venta", "roas-real", "primera-difusion"];
const NEWS = ["novedades-grupos", "novedades-difusiones", "novedades-dashboard"];

export class HelpServices {
  public constructor(
    private readonly library: ArticleLibrary,
    private readonly tutorials: Pick<TutorialServices, "forViewer">,
    private readonly support: Pick<SupportRepository, "settings">,
    private readonly onboarding: OnboardingProbe,
    private readonly feedback: FeedbackRepository
  ) {}

  public async home(viewer: HelpViewer): Promise<HelpHomeResponse> {
    const [articles, tutorials, support, onboarding] = await Promise.all([this.visible(), this.tutorials.forViewer(viewer), this.support.settings(), this.onboarding.steps(viewer.tenantId)]);
    const bySlug = new Map(articles.map((article) => [article.slug, article]));
    const pick = (slugs: ReadonlyArray<string>) => slugs.map((slug) => bySlug.get(slug)).filter((a): a is Article => Boolean(a)).map(toSummary);
    return {
      modules: HELP_MODULES.map((m) => ({ id: m.id, name: m.name, description: m.description, articles: articles.filter((a) => a.module === m.id && !NEWS.includes(a.slug)).length })),
      popular: pick(POPULAR),
      news: pick(NEWS),
      onboarding,
      tutorials,
      support,
      canManage: viewer.canManage
    };
  }

  public async module(moduleId: string): Promise<ReadonlyArray<ArticleSummary>> {
    return (await this.visible()).filter((a) => a.module === moduleId && !NEWS.includes(a.slug)).sort((a, b) => a.order - b.order).map(toSummary);
  }

  public async article(viewer: HelpViewer, slug: string): Promise<ArticleDetail> {
    const articles = await this.library.all();
    const article = articles.find((a) => a.slug === slug);
    if (!article) throw new NotFoundError("Ese artículo no existe.");
    const tutorials = await this.tutorials.forViewer(viewer);
    const related = article.related.map((r) => articles.find((a) => a.slug === r)).filter((a): a is Article => Boolean(a) && !a!.agentsOnly).map(toSummary);
    return {
      ...toSummary(article),
      body: article.body,
      sections: sectionsOf(article.body),
      related,
      tutorial: tutorials.find((t: Tutorial) => t.articleSlug === slug) ?? tutorials.find((t) => t.module === article.module) ?? null
    };
  }

  public async search(query: string, includeAgents = false): Promise<ReadonlyArray<ArticleSummary>> {
    return searchArticles(includeAgents ? await this.library.all() : await this.visible(), query).map(toSummary);
  }

  public async rate(viewer: HelpViewer, slug: string, helpful: boolean, comment: string | null): Promise<void> {
    if (!(await this.library.all()).some((a) => a.slug === slug)) throw new NotFoundError("Ese artículo no existe.");
    await this.feedback.rate(viewer.tenantId, viewer.userId, slug, helpful, comment ? comment.slice(0, 1000) : null);
  }

  /** Todo, como texto: para agentes (MCP) y `llms.txt`. */
  public async documents(): Promise<ReadonlyArray<Article>> {
    return [...(await this.library.all())].sort((a, b) => Number(b.agentsOnly) - Number(a.agentsOnly) || a.module.localeCompare(b.module) || a.order - b.order);
  }

  private async visible(): Promise<ReadonlyArray<Article>> {
    return (await this.library.all()).filter((article) => !article.agentsOnly);
  }
}
