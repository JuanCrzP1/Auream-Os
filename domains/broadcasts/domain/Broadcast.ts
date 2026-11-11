import type { BroadcastStatus } from "../../../contracts/BroadcastResultsContracts";
import type { BroadcastDraft } from "./BroadcastDraft";

// ---------------------------------------------------------------------------
// Una difusión guardada y su ciclo de vida:
//
//   scheduled ──(su hora)──> sending ──(sin pendientes)──> done
//                              │  ↑            │ con prueba A/B, la primera parte
//              pausar / fallos │  │ seguir     └──> testing ──(decide)──> sending
//                              ▼  │
//                       paused · auto_paused
//   cualquiera sin terminar ──cancelar──> cancelled
// ---------------------------------------------------------------------------

export interface Broadcast extends BroadcastDraft {
  readonly id: string;
  readonly tenantId: string;
  readonly status: BroadcastStatus;
  readonly statusReason: string | null;
  readonly parentId: string | null;
  /** Prueba A/B: la versión ganadora y cuándo se decide. */
  readonly winner: number | null;
  readonly decidesAt: string | null;
  /** Segundo envío: cuándo sale y la difusión que lo lleva. */
  readonly followUpDueAt: string | null;
  readonly followUpChildId: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

export const FINAL_STATUSES: ReadonlyArray<BroadcastStatus> = ["done", "cancelled"];

export const canPause = (status: BroadcastStatus) => status === "sending" || status === "scheduled";
export const canResume = (status: BroadcastStatus) => status === "paused" || status === "auto_paused";
export const canCancel = (status: BroadcastStatus) => !FINAL_STATUSES.includes(status);

/** ¿Ya se armó la lista de destinatarios? (una programada que se pausa antes de su hora, no). */
export const hasStarted = (broadcast: Pick<Broadcast, "startedAt">) => broadcast.startedAt !== null;

/** Motivos con los que una difusión se pausa sola (se muestran tal cual). */
export const AUTO_PAUSE = {
  failures: (rate: number) => `Se pausó sola: fallaron ${Math.round(rate * 100)} % de los envíos. Revisa el número antes de seguir.`,
  disconnected: (name: string) => `Se pausó sola: «${name}» se desconectó. Vuelve a vincularlo y dale «Seguir».`,
  noContent: "Se pausó sola: el flujo ya no existe o está archivado."
} as const;
