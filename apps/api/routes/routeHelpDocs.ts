import type { IncomingMessage, ServerResponse } from "node:http";
import { HELP_MODULES } from "../../../contracts/HelpContracts";
import type { HelpServices } from "../../../domains/help/application/HelpServices";

// ---------------------------------------------------------------------------
// La documentación pública, para personas y para IA (sin sesión: no tiene
// datos de ninguna cuenta):
//
//   GET /llms.txt                el índice estándar para modelos de lenguaje
//   GET /help/docs/<slug>.md     cada artículo en Markdown
// ---------------------------------------------------------------------------

const DOC = /^\/help\/docs\/([a-z0-9-]{2,80})\.md$/;

function text(response: ServerResponse, status: number, body: string, type: string): true {
  response.statusCode = status;
  response.setHeader("Content-Type", `${type}; charset=utf-8`);
  response.setHeader("Cache-Control", "public, max-age=600");
  response.end(body);
  return true;
}

export async function routeHelpDocs(request: IncomingMessage, response: ServerResponse, url: URL, help: Pick<HelpServices, "documents"> | undefined, docsBase: string): Promise<boolean> {
  const isIndex = url.pathname === "/llms.txt";
  const doc = DOC.exec(url.pathname);
  if ((!isIndex && !doc) || (request.method ?? "GET") !== "GET") return false;
  if (!help) return text(response, 503, "La documentación no está disponible.", "text/plain");
  const documents = await help.documents();

  if (doc) {
    const article = documents.find((item) => item.slug === doc[1]);
    if (!article) return text(response, 404, "Ese artículo no existe.", "text/plain");
    return text(response, 200, `# ${article.title}\n\n> ${article.summary}\n\n${article.body}\n`, "text/markdown");
  }

  const line = (a: (typeof documents)[number]) => `- [${a.title}](${docsBase}/${a.slug}.md): ${a.summary}`;
  const sections = [
    "# Auream OS",
    "",
    "> Plataforma para vender por WhatsApp: automatizaciones (flujos), bandeja de conversaciones, CRM, ventas con precio por país, Dashboard con ROAS real, Meta Ads, difusiones y grupos. Toda la documentación está en español.",
    "",
    "Antes de actuar sobre una cuenta (por ejemplo por el servidor MCP de Auream), lee la guía para agentes.",
    "",
    "## Para agentes de IA",
    ...documents.filter((a) => a.agentsOnly).map(line),
    ...HELP_MODULES.flatMap((m) => {
      const list = documents.filter((a) => !a.agentsOnly && a.module === m.id);
      return list.length ? ["", `## ${m.name}`, ...list.map(line)] : [];
    })
  ];
  return text(response, 200, `${sections.join("\n")}\n`, "text/plain");
}
