import type { OnboardingStep, SaveTutorialRequest, SupportCase, SupportCaseStatus, SupportSettings, Tutorial } from "../../../contracts/HelpContracts";
import type { Article } from "../domain/Article";
import type { VideoLink } from "../domain/HelpRules";

// ---------------------------------------------------------------------------
// Lo que Ayuda necesita de fuera. Los artículos los da una biblioteca (los
// Markdown del repositorio); tutoriales, casos, datos de soporte y opiniones,
// la base. Lo que un tutorial o un caso guarda es de la PLATAFORMA (lo ven
// todas las cuentas), salvo los casos y opiniones, que son de cada cuenta.
// ---------------------------------------------------------------------------

export interface ArticleLibrary {
  all(): Promise<ReadonlyArray<Article>>;
}

export interface StoredTutorial extends Omit<Tutorial, "seen" | "views"> {
  readonly url: string;
}

export interface TutorialRepository {
  list(includeDrafts: boolean): Promise<ReadonlyArray<StoredTutorial & { readonly views: number }>>;
  save(id: string, input: SaveTutorialRequest & { readonly link: VideoLink }, position: number | null): Promise<void>;
  remove(id: string): Promise<boolean>;
  reorder(ids: ReadonlyArray<string>): Promise<void>;
  /** Lo que ya vio quien mira. */
  seenBy(userId: string): Promise<ReadonlySet<string>>;
  markSeen(tenantId: string, userId: string, tutorialId: string): Promise<void>;
}

export interface SupportRepository {
  settings(): Promise<SupportSettings>;
  saveSettings(settings: SupportSettings): Promise<void>;
  createCase(tenantId: string, userId: string, id: string, input: Omit<SupportCase, "id" | "status" | "reply" | "createdAt" | "answeredAt" | "account">): Promise<void>;
  casesOf(tenantId: string, userId: string): Promise<ReadonlyArray<SupportCase>>;
  /** Para el equipo de Auream: todos, con la cuenta y el correo de quien escribió. */
  allCases(status: SupportCaseStatus | null, limit: number): Promise<ReadonlyArray<SupportCase>>;
  reply(id: string, reply: string, status: SupportCaseStatus, at: Date): Promise<boolean>;
}

export interface FeedbackRepository {
  rate(tenantId: string, userId: string, slug: string, helpful: boolean, comment: string | null): Promise<void>;
}

/** «Empieza aquí»: qué ya hizo la cuenta (se marca solo). */
export interface OnboardingProbe {
  steps(tenantId: string): Promise<ReadonlyArray<OnboardingStep>>;
}
