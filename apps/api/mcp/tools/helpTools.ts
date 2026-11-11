import type { HelpServices } from "../../../../domains/help/application/HelpServices";
import type { McpTool } from "../McpTool";

// ---------------------------------------------------------------------------
// La documentación de Auream para agentes: la guía (qué es cada módulo, cómo
// se relacionan, las reglas que no se pueden romper y qué herramienta usar),
// buscar y leer cualquier artículo. No piden permiso: no tocan datos de la cuenta.
// ---------------------------------------------------------------------------

export function helpTools(help: Pick<HelpServices, "documents" | "search">): McpTool[] {
  return [
    {
      name: "read_platform_guide",
      title: "Leer la guía de Auream para agentes",
      description: "Léela ANTES de actuar en una cuenta: qué es cada módulo de Auream, cómo se relacionan (etiquetas, etapas del CRM, ventas, difusiones, grupos), las reglas que no se pueden romper y qué herramienta usar para cada tarea.",
      scope: null,
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      run: async () => {
        const guides = (await help.documents()).filter((article) => article.agentsOnly);
        return { guide: guides.map((article) => `# ${article.title}\n\n${article.body}`).join("\n\n---\n\n") };
      }
    },
    {
      name: "search_help",
      title: "Buscar en la ayuda de Auream",
      description: "Busca en la documentación de Auream (en español) y devuelve los artículos más útiles con su slug. Úsala cuando no sepas cómo funciona algo antes de cambiarlo.",
      scope: null,
      readOnly: true,
      inputSchema: { type: "object", properties: { query: { type: "string", description: "Qué buscas, en palabras simples (p. ej. «reconectar número», «ROAS real»)." } }, required: ["query"] },
      run: async (args) => ({ results: await help.search(String(args["query"] ?? ""), true) })
    },
    {
      name: "read_help_article",
      title: "Leer un artículo de la ayuda",
      description: "Devuelve un artículo completo de la ayuda de Auream en Markdown, por su slug (de search_help).",
      scope: null,
      readOnly: true,
      inputSchema: { type: "object", properties: { slug: { type: "string", description: "El slug del artículo." } }, required: ["slug"] },
      run: async (args) => {
        const article = (await help.documents()).find((item) => item.slug === String(args["slug"] ?? ""));
        return article ? { title: article.title, module: article.module, body: article.body } : { error: "Ese artículo no existe. Busca primero con search_help." };
      }
    }
  ];
}
