import { HELP_MODULES, type ArticleSummary, type HelpModuleId } from "../../../contracts/HelpContracts";

// ---------------------------------------------------------------------------
// Un artículo de ayuda: Markdown con un encabezado de metadatos
//
//   ---
//   title: Conectar tu WhatsApp con el código QR
//   module: conexiones
//   summary: Vincula tu número en un minuto…
//   order: 1
//   updated: 2026-11-11
//   keywords: qr, vincular, número
//   related: numero-desconectado, varios-numeros
//   ---
//
// Lo leen las personas (Ayuda), los agentes (MCP) y `llms.txt`.
// ---------------------------------------------------------------------------

export interface Article extends ArticleSummary {
  readonly body: string;
  readonly order: number;
  readonly keywords: ReadonlyArray<string>;
  readonly related: ReadonlyArray<string>;
  /** Solo para agentes (no sale en el centro de ayuda). */
  readonly agentsOnly: boolean;
}

const MODULE_IDS = new Set<string>(HELP_MODULES.map((m) => m.id));
const WORDS_PER_MINUTE = 200;

/** `null` si el archivo no tiene los metadatos mínimos (título y módulo válidos). */
export function parseArticle(slug: string, source: string): Article | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) return null;
  const meta = new Map<string, string>();
  for (const line of match[1]!.split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) meta.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  const title = meta.get("title") ?? "";
  const module = meta.get("module") ?? "";
  const agentsOnly = module === "agentes";
  if (!title || (!MODULE_IDS.has(module) && !agentsOnly)) return null;
  const body = match[2]!.trim();
  const list = (key: string) => (meta.get(key) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  return {
    slug,
    title,
    module: (agentsOnly ? "primeros-pasos" : module) as HelpModuleId,
    summary: meta.get("summary") ?? "",
    minutes: Math.max(1, Math.round(body.split(/\s+/).length / WORDS_PER_MINUTE)),
    updated: meta.get("updated") ?? "",
    body,
    order: Number(meta.get("order") ?? 99) || 99,
    keywords: list("keywords"),
    related: list("related"),
    agentsOnly
  };
}

/** «Si algo falla» → «si-algo-falla» (el ancla de cada sección). */
export function anchorOf(title: string): string {
  return title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function sectionsOf(body: string): Array<{ id: string; title: string }> {
  return [...body.matchAll(/^## +(.+)$/gm)].map((m) => ({ id: anchorOf(m[1]!.trim()), title: m[1]!.trim() }));
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Búsqueda por palabras: el título pesa más que las palabras clave, y estas más que el texto. */
export function searchArticles(articles: ReadonlyArray<Article>, query: string, limit = 8): Article[] {
  const terms = normalize(query).split(/[^a-z0-9ñ]+/).filter((term) => term.length >= 2);
  if (terms.length === 0) return [];
  const scored = articles.map((article) => {
    const title = normalize(article.title);
    const keys = normalize(article.keywords.join(" ") + " " + article.summary);
    const body = normalize(article.body);
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 6 : 0) + (keys.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0), 0);
    return { article, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.article.order - b.article.order).slice(0, limit).map((s) => s.article);
}

export function toSummary(article: Article): ArticleSummary {
  return { slug: article.slug, title: article.title, module: article.module, summary: article.summary, minutes: article.minutes, updated: article.updated };
}
