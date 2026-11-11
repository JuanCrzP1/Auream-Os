import { HELP_MODULES, SUPPORT_TOPICS, type CreateSupportCaseRequest, type SaveTutorialRequest, type SupportSettings, type SupportTopic } from "../../../contracts/HelpContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Lo que se acepta en Ayuda: un tutorial (solo enlaces de YouTube o Vimeo,
// que se reproducen dentro de Auream), un caso de soporte y los datos de
// contacto de soporte.
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export interface VideoLink {
  readonly provider: "youtube" | "vimeo";
  readonly id: string;
  readonly embedUrl: string;
  readonly thumbnailUrl: string | null;
}

/** youtu.be/ID · youtube.com/watch?v=ID · /shorts/ID · /embed/ID · vimeo.com/ID. `null` si no es ninguno. */
export function parseVideoLink(raw: string): VideoLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let youtube: string | null = null;
  if (host === "youtu.be") youtube = url.pathname.slice(1).split("/")[0] ?? null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") youtube = url.searchParams.get("v") ?? (/^\/(?:shorts|embed|live)\/([^/?]+)/.exec(url.pathname)?.[1] ?? null);
  if (youtube && /^[A-Za-z0-9_-]{6,20}$/.test(youtube)) {
    return { provider: "youtube", id: youtube, embedUrl: `https://www.youtube-nocookie.com/embed/${youtube}?rel=0`, thumbnailUrl: `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` };
  }
  const vimeo = host === "vimeo.com" || host === "player.vimeo.com" ? /\/(?:video\/)?(\d{6,12})/.exec(url.pathname)?.[1] : undefined;
  if (vimeo) return { provider: "vimeo", id: vimeo, embedUrl: `https://player.vimeo.com/video/${vimeo}`, thumbnailUrl: null };
  return null;
}

export function requireTutorial(value: unknown): SaveTutorialRequest & { readonly link: VideoLink } {
  const input = isRecord(value) ? value : {};
  const link = parseVideoLink(str(input["url"], 500));
  if (!link) throw new ValidationError("Pega un enlace de YouTube o de Vimeo.");
  const title = str(input["title"], 120);
  if (!title) throw new ValidationError("Ponle un título al tutorial.");
  const module = str(input["module"], 40);
  if (!HELP_MODULES.some((m) => m.id === module)) throw new ValidationError("Elige el módulo del tutorial.");
  const duration = str(input["duration"], 8);
  if (duration && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) throw new ValidationError("La duración va como 4:12.");
  return {
    url: str(input["url"], 500),
    title,
    description: str(input["description"], 300),
    module: module as SaveTutorialRequest["module"],
    duration,
    articleSlug: str(input["articleSlug"], 80) || null,
    featured: input["featured"] === true,
    published: input["published"] === true,
    link
  };
}

export function requireSupportCase(value: unknown): CreateSupportCaseRequest {
  const input = isRecord(value) ? value : {};
  const topic = SUPPORT_TOPICS.includes(input["topic"] as SupportTopic) ? (input["topic"] as SupportTopic) : "Otro";
  const message = str(input["message"], 4000);
  if (message.length < 5) throw new ValidationError("Cuéntanos qué pasa (al menos una frase).");
  const screenshot = str(input["screenshotUrl"], 1000);
  return {
    topic,
    message,
    page: str(input["page"], 200) || "/",
    screenshotUrl: /^https?:\/\//.test(screenshot) ? screenshot : null,
    articleSlug: str(input["articleSlug"], 80) || null
  };
}

export function requireSupportSettings(value: unknown): SupportSettings {
  const input = isRecord(value) ? value : {};
  const whatsapp = str(input["whatsapp"], 20).replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) throw new ValidationError("El WhatsApp de soporte va con el código del país, por ejemplo 573001234567.");
  const email = str(input["email"], 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("El correo de soporte no es válido.");
  return { whatsapp: whatsapp || null, email: email || null, hours: str(input["hours"], 120) || null, responseTime: str(input["responseTime"], 60) || null };
}
