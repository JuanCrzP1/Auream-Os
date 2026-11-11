import type { Tutorial } from "../../../contracts/HelpContracts";
import { AccessError } from "../../../platform/authorization/domain/AccessError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { requireTutorial } from "../domain/HelpRules";
import type { TutorialRepository } from "./HelpPorts";
import type { HelpViewer } from "./HelpServices";

// ---------------------------------------------------------------------------
// Tutoriales en video: los publica el equipo de Auream (enlaces de YouTube o
// Vimeo) y los ven todas las cuentas. Quien mira deja marcado lo que ya vio.
// ---------------------------------------------------------------------------

export class TutorialServices {
  public constructor(
    private readonly repository: TutorialRepository,
    private readonly newId: () => string
  ) {}

  /** Los publicados (o todos, para el equipo de Auream), con lo que ya vio quien mira. */
  public async forViewer(viewer: HelpViewer, includeDrafts = false): Promise<Tutorial[]> {
    const [list, seen] = await Promise.all([this.repository.list(includeDrafts && viewer.canManage), this.repository.seenBy(viewer.userId)]);
    return list.map((t) => ({
      id: t.id, title: t.title, description: t.description, module: t.module, provider: t.provider, embedUrl: t.embedUrl, thumbnailUrl: t.thumbnailUrl,
      duration: t.duration, articleSlug: t.articleSlug, featured: t.featured, published: t.published, position: t.position, seen: seen.has(t.id), views: viewer.canManage ? t.views : 0
    }));
  }

  public async save(viewer: HelpViewer, id: string | null, body: unknown): Promise<Tutorial[]> {
    this.requireManager(viewer);
    const input = requireTutorial(body);
    if (id && !(await this.repository.list(true)).some((t) => t.id === id)) throw new NotFoundError("Ese tutorial no existe.");
    await this.repository.save(id ?? this.newId(), input, id ? null : (await this.repository.list(true)).length + 1);
    return this.forViewer(viewer, true);
  }

  public async remove(viewer: HelpViewer, id: string): Promise<Tutorial[]> {
    this.requireManager(viewer);
    if (!(await this.repository.remove(id))) throw new NotFoundError("Ese tutorial no existe.");
    return this.forViewer(viewer, true);
  }

  public async reorder(viewer: HelpViewer, ids: unknown): Promise<Tutorial[]> {
    this.requireManager(viewer);
    if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) await this.repository.reorder(ids as string[]);
    return this.forViewer(viewer, true);
  }

  public async markSeen(viewer: HelpViewer, id: string): Promise<void> {
    await this.repository.markSeen(viewer.tenantId, viewer.userId, id);
  }

  private requireManager(viewer: HelpViewer): void {
    if (!viewer.canManage) throw new AccessError("Solo el equipo de Auream administra los tutoriales.");
  }
}
