import type { SaveTutorialRequest } from "../../../contracts/HelpContracts";
import type { StoredTutorial, TutorialRepository } from "../../../domains/help/application/HelpPorts";
import type { VideoLink } from "../../../domains/help/domain/HelpRules";
import type { SqlClient } from "./SqlClient";

// SqlHelpTutorials — `help_tutorials` y `help_tutorial_views` (036). Los
// tutoriales son de la plataforma (los ven todas las cuentas); las vistas,
// de cada persona.

interface TutorialRow {
  readonly id: string; readonly title: string; readonly description: string; readonly module: StoredTutorial["module"]; readonly url: string;
  readonly provider: StoredTutorial["provider"]; readonly embed_url: string; readonly thumbnail_url: string | null; readonly duration: string;
  readonly article_slug: string | null; readonly featured: boolean; readonly published: boolean; readonly position: number; readonly views: string;
}

export class SqlHelpTutorials implements TutorialRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(includeDrafts: boolean) {
    const result = await this.sql.query<TutorialRow>(
      `select t.*, (select count(*) from help_tutorial_views v where v.tutorial_id = t.id) as views
         from help_tutorials t where $1 or t.published order by t.position, t.created_at`,
      [includeDrafts]
    );
    return result.rows.map((row) => ({
      id: row.id, title: row.title, description: row.description, module: row.module, url: row.url, provider: row.provider, embedUrl: row.embed_url,
      thumbnailUrl: row.thumbnail_url, duration: row.duration, articleSlug: row.article_slug, featured: row.featured, published: row.published, position: row.position, views: Number(row.views)
    }));
  }

  public async save(id: string, input: SaveTutorialRequest & { readonly link: VideoLink }, position: number | null): Promise<void> {
    await this.sql.transaction(async (tx) => {
      // Un solo destacado: el video grande de «Empieza por aquí».
      if (input.featured) await tx.query("update help_tutorials set featured = false where id <> $1", [id]);
      await tx.query(
        `insert into help_tutorials (id, title, description, module, url, provider, embed_url, thumbnail_url, duration, article_slug, featured, published, position)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, coalesce($13, 0))
         on conflict (id) do update set title = excluded.title, description = excluded.description, module = excluded.module, url = excluded.url,
           provider = excluded.provider, embed_url = excluded.embed_url, thumbnail_url = excluded.thumbnail_url, duration = excluded.duration,
           article_slug = excluded.article_slug, featured = excluded.featured, published = excluded.published, updated_at = now()`,
        [id, input.title, input.description, input.module, input.url, input.link.provider, input.link.embedUrl, input.link.thumbnailUrl, input.duration, input.articleSlug, input.featured, input.published, position]
      );
    });
  }

  public async remove(id: string): Promise<boolean> {
    return ((await this.sql.query("delete from help_tutorials where id = $1", [id])).rowCount ?? 0) > 0;
  }

  public async reorder(ids: ReadonlyArray<string>): Promise<void> {
    await this.sql.query("update help_tutorials t set position = o.n from unnest($1::uuid[]) with ordinality as o(id, n) where t.id = o.id", [ids]);
  }

  public async seenBy(userId: string): Promise<ReadonlySet<string>> {
    const result = await this.sql.query<{ tutorial_id: string }>("select tutorial_id from help_tutorial_views where user_id = $1", [userId]);
    return new Set(result.rows.map((row) => row.tutorial_id));
  }

  public async markSeen(tenantId: string, userId: string, tutorialId: string): Promise<void> {
    await this.sql.query("insert into help_tutorial_views (tutorial_id, user_id, tenant_id) select $1, $2, $3 where exists (select 1 from help_tutorials where id = $1) on conflict do nothing", [tutorialId, userId, tenantId]);
  }
}
