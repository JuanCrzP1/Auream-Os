import type { CreateGroupPostRequest, GroupPostKind } from "@contracts/GroupContracts";

export interface PostDraft {
  readonly campaignIds: ReadonlyArray<string>;
  readonly groupIds: ReadonlyArray<string>;
  readonly kind: GroupPostKind;
  readonly text: string;
  readonly media: { readonly url: string; readonly fileName: string } | null;
  readonly choices: ReadonlyArray<string>;
  readonly mentionAll: boolean;
  /** `datetime-local` o `null` (ahora). */
  readonly scheduledAt: string | null;
}

export const KINDS: ReadonlyArray<readonly [GroupPostKind, string]> = [["text", "Texto"], ["image", "Foto"], ["video", "Video"], ["audio", "Audio"], ["poll", "Encuesta"]];

/** Empieza con una campaña elegida, o con un solo grupo (desde la tarjeta del grupo). */
export function emptyPost(preset: string | null, presetGroup: string | null = null): PostDraft {
  return { campaignIds: preset && !presetGroup ? [preset] : [], groupIds: presetGroup ? [presetGroup] : [], kind: "text", text: "", media: null, choices: ["", ""], mentionAll: true, scheduledAt: null };
}

export function postProblem(draft: PostDraft, groups: number): string | null {
  if (groups === 0) return "Elige a qué grupos se envía.";
  if (draft.kind === "text" && !draft.text.trim()) return "Escribe el mensaje.";
  if ((draft.kind === "image" || draft.kind === "video" || draft.kind === "audio") && !draft.media) return "Sube el archivo.";
  if (draft.kind === "poll" && (!draft.text.trim() || draft.choices.filter((c) => c.trim()).length < 2)) return "Escribe la pregunta y al menos 2 opciones.";
  if (draft.scheduledAt && new Date(draft.scheduledAt).getTime() < Date.now()) return "La hora programada ya pasó.";
  return null;
}

export function toRequest(draft: PostDraft): CreateGroupPostRequest {
  return {
    campaignIds: draft.campaignIds,
    groupIds: draft.groupIds,
    content: { kind: draft.kind, text: draft.text.trim(), mediaUrl: draft.media?.url ?? null, fileName: draft.media?.fileName ?? null, choices: draft.kind === "poll" ? draft.choices.map((c) => c.trim()).filter(Boolean) : [] },
    mentionAll: draft.mentionAll,
    scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null
  };
}
