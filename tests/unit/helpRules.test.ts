import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parseArticle, searchArticles, sectionsOf } from "../../domains/help/domain/Article.js";
import { parseVideoLink, requireSupportCase, requireSupportSettings, requireTutorial } from "../../domains/help/domain/HelpRules.js";
import { HelpServices } from "../../domains/help/application/HelpServices.js";
import { TutorialServices } from "../../domains/help/application/TutorialServices.js";
import { MarkdownArticleLibrary } from "../../infrastructure/help/MarkdownArticleLibrary.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";

// ---------------------------------------------------------------------------
// Ayuda: los artículos (metadatos, secciones, búsqueda), los enlaces de video
// que se aceptan, los casos y datos de soporte, y que los artículos del
// repositorio estén completos (todos se leen y sus relacionados existen).
// ---------------------------------------------------------------------------

const viewer = { tenantId: "t", userId: "u", canManage: false };

describe("artículos", () => {
  it("lee los metadatos y las secciones; sin título o módulo no es un artículo", () => {
    const article = parseArticle("hola", "---\ntitle: Hola\nmodule: conexiones\nsummary: Algo\nkeywords: qr, número\nrelated: a, b\n---\nTexto\n\n## Pasos\n\n1. Uno\n\n## Si algo falla\n")!;
    expect(article).toMatchObject({ slug: "hola", title: "Hola", module: "conexiones", keywords: ["qr", "número"], related: ["a", "b"], agentsOnly: false, minutes: 1 });
    expect(sectionsOf(article.body)).toEqual([{ id: "pasos", title: "Pasos" }, { id: "si-algo-falla", title: "Si algo falla" }]);
    expect(parseArticle("x", "sin metadatos")).toBeNull();
    expect(parseArticle("x", "---\ntitle: X\nmodule: nada\n---\n")).toBeNull();
    expect(parseArticle("g", "---\ntitle: Guía\nmodule: agentes\n---\nreglas")?.agentsOnly).toBe(true);
  });

  it("la búsqueda pesa el título sobre las palabras clave y el texto, sin tildes", () => {
    const a = parseArticle("a", "---\ntitle: Conectar tu número\nmodule: conexiones\nkeywords: qr\n---\nEscanea.")!;
    const b = parseArticle("b", "---\ntitle: Difusiones\nmodule: difusiones\n---\nEl numero no se bloquea.")!;
    expect(searchArticles([b, a], "número").map((x) => x.slug)).toEqual(["a", "b"]);
    expect(searchArticles([a, b], "a")).toEqual([]);
  });

  it("los artículos del repositorio se leen todos y sus relacionados existen", async () => {
    const all = await new MarkdownArticleLibrary(join(process.cwd(), "content", "help")).all();
    expect(all.length).toBeGreaterThanOrEqual(45);
    const slugs = new Set(all.map((a) => a.slug));
    expect(all.flatMap((a) => a.related).filter((slug) => !slugs.has(slug))).toEqual([]);
    expect(all.find((a) => a.agentsOnly)?.slug).toBe("guia-para-agentes");
  });

  it("la portada no muestra la guía de agentes; los agentes la encuentran", async () => {
    const library = new MarkdownArticleLibrary(join(process.cwd(), "content", "help"));
    const tutorials = { forViewer: async () => [] };
    const services = new HelpServices(library, tutorials, { settings: async () => ({ whatsapp: null, email: null, hours: null, responseTime: null }) }, { steps: async () => [] }, { rate: async () => undefined });
    const home = await services.home(viewer);
    expect(home.popular.map((a) => a.slug)).toContain("conectar-whatsapp-qr");
    expect(home.modules.find((m) => m.id === "difusiones")?.articles).toBe(5);
    expect((await services.search("guía agentes")).some((a) => a.slug === "guia-para-agentes")).toBe(false);
    expect((await services.search("guía agentes", true))[0]?.slug).toBe("guia-para-agentes");
    expect((await services.article(viewer, "conectar-whatsapp-qr")).sections.map((s) => s.title)).toContain("Pasos");
  });
});

describe("tutoriales y soporte", () => {
  it("solo enlaces de YouTube o Vimeo, que se reproducen sin cookies", () => {
    expect(parseVideoLink("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" });
    expect(parseVideoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")?.id).toBe("dQw4w9WgXcQ");
    expect(parseVideoLink("https://youtube.com/shorts/abcdefghijk")?.id).toBe("abcdefghijk");
    expect(parseVideoLink("https://vimeo.com/123456789")).toMatchObject({ provider: "vimeo", embedUrl: "https://player.vimeo.com/video/123456789" });
    expect(parseVideoLink("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(() => requireTutorial({ url: "https://youtu.be/dQw4w9WgXcQ", title: "", module: "crm" })).toThrow(/título/);
    expect(() => requireTutorial({ url: "https://youtu.be/dQw4w9WgXcQ", title: "X", module: "otro" })).toThrow(/módulo/);
  });

  it("solo el equipo de Auream administra tutoriales", async () => {
    const services = new TutorialServices({ list: async () => [], save: async () => undefined, remove: async () => true, reorder: async () => undefined, seenBy: async () => new Set(), markSeen: async () => undefined }, () => "id");
    await expect(services.save(viewer, null, { url: "https://youtu.be/dQw4w9WgXcQ", title: "X", module: "crm" })).rejects.toBeInstanceOf(AccessError);
    await expect(services.save({ ...viewer, canManage: true }, null, { url: "https://youtu.be/dQw4w9WgXcQ", title: "X", module: "crm" })).resolves.toEqual([]);
  });

  it("un caso necesita mensaje; los datos de soporte se validan", () => {
    expect(() => requireSupportCase({ message: "a" })).toThrow(/qué pasa/);
    expect(requireSupportCase({ topic: "Flujos", message: "No responde", page: "/automations", screenshotUrl: "javascript:x" })).toMatchObject({ topic: "Flujos", page: "/automations", screenshotUrl: null });
    expect(requireSupportSettings({ whatsapp: "+57 300 123 4567", email: "soporte@auream.co" })).toMatchObject({ whatsapp: "573001234567", email: "soporte@auream.co", hours: null });
    expect(() => requireSupportSettings({ email: "no" })).toThrow(/correo/);
  });
});
