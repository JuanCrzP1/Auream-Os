// ---------------------------------------------------------------------------
// Ayuda: centro de ayuda (artículos por módulo), tutoriales en video que
// publica el equipo de Auream, «Empieza aquí» y soporte (casos y contacto).
// Contrato único entre API y web. Los artículos viven en `content/help/*.md`.
// ---------------------------------------------------------------------------

export const HELP_MODULES = [
  { id: "primeros-pasos", name: "Primeros pasos", description: "Crear la cuenta, la empresa y lo esencial", path: null },
  { id: "conexiones", name: "Conexiones", description: "Conectar WhatsApp con QR, reconectar y varios números", path: "/connections" },
  { id: "automatizaciones", name: "Automatizaciones", description: "Flujos, las 13 herramientas y el laboratorio", path: "/automations" },
  { id: "conversaciones", name: "Conversaciones", description: "La bandeja, responder, pausar el bot y etiquetas", path: "/conversations" },
  { id: "crm", name: "CRM", description: "Embudos, etapas, responsables y seguimientos", path: "/crm" },
  { id: "ventas", name: "Ventas y productos", description: "Precios por país, Registrar venta y por revisar", path: "/sales" },
  { id: "dashboard", name: "Dashboard y Meta Ads", description: "ROAS real, ganancia y qué hacer con cada campaña", path: "/dashboard" },
  { id: "difusiones", name: "Difusiones", description: "Envío seguro, versiones, prueba A/B y resultados", path: "/broadcasts" },
  { id: "grupos", name: "Grupos y comunidades", description: "Enlace que llena grupos, envíos y lo que vende cada grupo", path: "/groups" },
  { id: "equipo", name: "Equipo y cuenta", description: "Roles, invitaciones, perfil y zona horaria", path: "/settings" }
] as const;

export type HelpModuleId = (typeof HELP_MODULES)[number]["id"];

export interface ArticleSummary {
  readonly slug: string;
  readonly title: string;
  readonly module: HelpModuleId;
  readonly summary: string;
  readonly minutes: number;
  readonly updated: string;
}

export interface ArticleDetail extends ArticleSummary {
  /** Markdown (sin el encabezado de metadatos). */
  readonly body: string;
  /** Los títulos `##` para el índice «En este artículo». */
  readonly sections: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly related: ReadonlyArray<ArticleSummary>;
  readonly tutorial: Tutorial | null;
}

export interface Tutorial {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly module: HelpModuleId;
  readonly provider: "youtube" | "vimeo";
  /** Dirección para el reproductor (`youtube-nocookie.com/embed/…` o `player.vimeo.com/video/…`). */
  readonly embedUrl: string;
  readonly thumbnailUrl: string | null;
  readonly duration: string;
  readonly articleSlug: string | null;
  readonly featured: boolean;
  readonly published: boolean;
  readonly position: number;
  /** Si quien mira ya lo vio. */
  readonly seen: boolean;
  readonly views: number;
}

export interface SaveTutorialRequest {
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly module: HelpModuleId;
  readonly duration: string;
  readonly articleSlug: string | null;
  readonly featured: boolean;
  readonly published: boolean;
}

/** Cómo contactar a soporte (lo configura el equipo de Auream). */
export interface SupportSettings {
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly hours: string | null;
  readonly responseTime: string | null;
}

export const SUPPORT_TOPICS = ["Mi número", "Flujos", "Difusiones", "Grupos", "Ventas", "Pagos", "Otro"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
export type SupportCaseStatus = "open" | "answered" | "closed";

export interface CreateSupportCaseRequest {
  readonly topic: SupportTopic;
  readonly message: string;
  /** La pantalla desde donde escribe (se adjunta sola). */
  readonly page: string;
  readonly screenshotUrl: string | null;
  readonly articleSlug: string | null;
}

export interface SupportCase extends CreateSupportCaseRequest {
  readonly id: string;
  readonly status: SupportCaseStatus;
  readonly reply: string | null;
  readonly createdAt: string;
  readonly answeredAt: string | null;
  /** Solo en la vista del equipo de Auream. */
  readonly account?: { readonly tenantId: string; readonly tenantName: string; readonly userEmail: string | null };
}

export interface OnboardingStep {
  readonly id: "number" | "flow" | "products" | "team" | "meta" | "broadcast";
  readonly title: string;
  readonly detail: string;
  readonly done: boolean;
  readonly path: string;
}

export interface HelpHomeResponse {
  readonly modules: ReadonlyArray<{ readonly id: HelpModuleId; readonly name: string; readonly description: string; readonly articles: number }>;
  readonly popular: ReadonlyArray<ArticleSummary>;
  readonly news: ReadonlyArray<ArticleSummary>;
  readonly onboarding: ReadonlyArray<OnboardingStep>;
  readonly tutorials: ReadonlyArray<Tutorial>;
  readonly support: SupportSettings;
  /** El equipo de Auream: ve «Administrar ayuda». */
  readonly canManage: boolean;
}

export interface FeedbackRequest {
  readonly helpful: boolean;
  readonly comment: string | null;
}
