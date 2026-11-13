import type { MoneyAmount } from "./BroadcastResultsContracts";

// ---------------------------------------------------------------------------
// Grupos y comunidades de WhatsApp: campañas con un enlace único que llena
// grupos (crea el siguiente al llenarse), los grupos de cada número, mensajes
// a muchos grupos y lo que vende cada uno. Contrato único entre API y web.
// ---------------------------------------------------------------------------

export const GROUP_LIMITS = {
  /** WhatsApp admite hasta 1024; se deja margen para que el enlace nunca lleve a un grupo lleno. */
  defaultCapacity: 1000,
  minCapacity: 20,
  maxCapacity: 1024,
  /** Al llegar a esta parte del cupo se prepara el grupo siguiente. */
  prepareAt: 0.9,
  /** WhatsApp admite 25 caracteres en el nombre; se reservan 4 para « #12». */
  maxNamePattern: 21,
  maxDescription: 512,
  maxWelcome: 500,
  maxPostText: 1000,
  maxPollChoices: 12,
  /** Pausa al azar entre un grupo y el siguiente al enviar, en segundos. */
  postPauseSeconds: [10, 30] as const,
  welcomeEveryMinutes: [5, 15, 30, 60] as const
} as const;

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export interface GroupTemplate {
  /** «Navidad · Dilo cantando»: cada grupo se llama así más « #1», « #2»… */
  readonly namePattern: string;
  readonly description: string;
  readonly imageUrl: string | null;
  /** Solo los administradores escriben. */
  readonly announce: boolean;
  /** Solo los administradores editan nombre, foto y descripción. */
  readonly locked: boolean;
}

export interface CampaignRules {
  /** Un solo mensaje cada N minutos con los que entraron: «Bienvenidos @Laura, @Andrés y 12 más». */
  readonly welcome: { readonly enabled: boolean; readonly text: string; readonly everyMinutes: number };
  /** Quien entra queda con una etiqueta con el nombre de la campaña (CRM). */
  readonly labelOnJoin: boolean;
}

export const DEFAULT_WELCOME = "¡Bienvenidos {nombres}! 🎉 Aquí compartimos las novedades primero.";

export interface SaveCampaignRequest {
  readonly name: string;
  readonly slug: string;
  /** Números que crean y administran los grupos (por turnos). */
  readonly connectionIds: ReadonlyArray<string>;
  readonly capacity: number;
  readonly template: GroupTemplate;
  readonly rules: CampaignRules;
}

export type CampaignStatus = "active" | "closed";
export type GroupState = "open" | "full" | "standby" | "other";

export interface GroupNumbers {
  readonly members: number;
  readonly joined: number;
  readonly left: number;
  readonly buyers: number;
  readonly revenue: ReadonlyArray<MoneyAmount>;
}

export interface GroupSummary extends GroupNumbers {
  readonly id: string;
  readonly connectionId: string;
  readonly connectionName: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly campaignId: string | null;
  readonly campaignName: string | null;
  readonly position: number | null;
  readonly state: GroupState;
  readonly isAdmin: boolean;
  readonly announce: boolean;
  readonly locked: boolean;
  /** El enlace de invitación de este grupo (solo si administras el grupo y ya se pidió a WhatsApp). */
  readonly inviteLink: string | null;
  readonly syncedAt: string | null;
}

export interface CampaignStats extends GroupNumbers {
  readonly clicks: number;
}

export interface CampaignSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  /** El enlace público: lleva al grupo con cupo. */
  readonly link: string;
  readonly status: CampaignStatus;
  readonly connections: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly capacity: number;
  readonly template: GroupTemplate;
  readonly rules: CampaignRules;
  readonly groups: ReadonlyArray<Pick<GroupSummary, "id" | "name" | "members" | "state" | "position">>;
  /** El grupo al que lleva el enlace ahora y cuántos cupos le quedan. */
  readonly current: { readonly groupId: string; readonly name: string; readonly free: number } | null;
  readonly stats: CampaignStats;
  readonly createdAt: string;
}

export interface GroupsOverviewResponse {
  readonly campaigns: ReadonlyArray<CampaignSummary>;
  /** Este mes, de todas las campañas. */
  readonly month: CampaignStats;
  readonly canManage: boolean;
  /** Hay al menos un número por QR conectado (los grupos necesitan uno). */
  readonly hasNumbers: boolean;
}

export interface GroupListResponse {
  readonly groups: ReadonlyArray<GroupSummary>;
  readonly syncedAt: string | null;
  readonly canManage: boolean;
}

export interface CampaignDetailResponse {
  readonly campaign: CampaignSummary;
  readonly groups: ReadonlyArray<GroupSummary>;
  readonly posts: ReadonlyArray<GroupPostSummary>;
  /** Los últimos 14 días. */
  readonly daily: ReadonlyArray<{ readonly day: string; readonly clicks: number; readonly joined: number; readonly left: number }>;
  readonly canManage: boolean;
}

export type GroupPostKind = "text" | "image" | "video" | "audio" | "poll";

export interface GroupPostContent {
  readonly kind: GroupPostKind;
  /** El texto, la leyenda del archivo o la pregunta de la encuesta. */
  readonly text: string;
  readonly mediaUrl: string | null;
  readonly fileName: string | null;
  readonly choices: ReadonlyArray<string>;
}

export interface CreateGroupPostRequest {
  readonly campaignIds: ReadonlyArray<string>;
  readonly groupIds: ReadonlyArray<string>;
  readonly content: GroupPostContent;
  /** Notifica a todos los miembros (aunque tengan el grupo silenciado). */
  readonly mentionAll: boolean;
  /** ISO. `null`: ahora. */
  readonly scheduledAt: string | null;
}

export type GroupPostStatus = "scheduled" | "sending" | "done" | "cancelled";

export interface GroupPostSummary {
  readonly id: string;
  readonly content: GroupPostContent;
  readonly mentionAll: boolean;
  readonly status: GroupPostStatus;
  readonly target: string;
  readonly groups: number;
  readonly sent: number;
  readonly failed: number;
  readonly scheduledAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
}
