import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArticleLibrary } from "../../domains/help/application/HelpPorts";
import { parseArticle, type Article } from "../../domains/help/domain/Article";

// ---------------------------------------------------------------------------
// Los artículos de ayuda: los Markdown de `content/help/<módulo>/<slug>.md`.
// Se leen una vez por proceso (cambian con cada versión de Auream, no en
// caliente). En Vercel la carpeta va con la función (`vercel.json`).
// ---------------------------------------------------------------------------

export class MarkdownArticleLibrary implements ArticleLibrary {
  private cache: Promise<ReadonlyArray<Article>> | null = null;

  public constructor(private readonly root: string = join(process.cwd(), "content", "help")) {}

  public all(): Promise<ReadonlyArray<Article>> {
    this.cache ??= this.load().catch((error: unknown) => {
      this.cache = null;
      throw error;
    });
    return this.cache;
  }

  private async load(): Promise<ReadonlyArray<Article>> {
    const articles: Article[] = [];
    for (const folder of await readdir(this.root, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue;
      for (const file of await readdir(join(this.root, folder.name))) {
        if (!file.endsWith(".md")) continue;
        const article = parseArticle(file.slice(0, -3), await readFile(join(this.root, folder.name, file), "utf8"));
        if (article) articles.push(article);
      }
    }
    return articles.sort((a, b) => a.module.localeCompare(b.module) || a.order - b.order);
  }
}
