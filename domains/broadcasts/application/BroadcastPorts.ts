import type { AudienceFilter } from "../../../contracts/BroadcastContracts";
import type { BroadcastStats, BroadcastStatus, MoneyAmount, RecipientFilter, RecipientsPage, SavedAudience, VariantResult } from "../../../contracts/BroadcastResultsContracts";
import type { BroadcastMedia } from "../../../contracts/BroadcastContracts";
import type { Broadcast } from "../domain/Broadcast";

// ---------------------------------------------------------------------------
// Lo que Difusiones necesita de fuera. Todo por cuenta. La composición decide
// quién cumple cada puerto (SQL, Mensajería, Conexiones, la cola de tareas).
// ---------------------------------------------------------------------------

export type BroadcastPatch = Partial<Pick<Broadcast, "statusReason" | "startedAt" | "finishedAt" | "winner" | "decidesAt" | "followUpDueAt" | "followUpChildId">>;

export interface BroadcastRepository {
  /** Guarda la difusión. Un segundo envío que ya existía para esa difusión no se repite. */
  create(broadcast: Broadcast): Promise<void>;
  find(tenantId: string, id: string): Promise<Broadcast | null>;
  /** Las más recientes primero. */
  list(tenantId: string, limit: number): Promise<ReadonlyArray<Broadcast>>;
  /** Cambia el estado SOLO si está en uno de `from` (dos procesos a la vez: gana uno). */
  transition(tenantId: string, id: string, from: ReadonlyArray<BroadcastStatus>, to: BroadcastStatus, patch?: BroadcastPatch): Promise<boolean>;
  update(tenantId: string, id: string, patch: BroadcastPatch): Promise<void>;
  /** El segundo envío de una difusión, si ya se creó. */
  childOf(tenantId: string, parentId: string): Promise<string | null>;
}

/** Alguien que puede recibir la difusión: ya escribió por ese número. */
export interface Candidate {
  readonly contactId: string | null;
  readonly name: string | null;
  readonly phone: string;
  readonly connectionId: string;
}

export interface RecipientRecord extends Candidate {
  readonly id: string;
  readonly variant: number;
}

export interface RecipientStore {
  /** Guarda la lista (en el orden dado). `variant: null` = espera al ganador de la prueba A/B. */
  insert(tenantId: string, broadcastId: string, recipients: ReadonlyArray<Candidate & { readonly variant: number | null }>): Promise<number>;
  /** Reserva el siguiente pendiente de ese número (con versión asignada). */
  claimNext(tenantId: string, broadcastId: string, connectionId: string, now: Date): Promise<RecipientRecord | null>;
  finish(tenantId: string, recipientId: string, outcome: { readonly status: "sent" | "failed" | "opted_out"; readonly providerMessageId: string | null; readonly error: string | null; readonly at: Date }): Promise<void>;
  /** Los que quedaron «enviando» desde antes de `before` (el proceso murió): fallidos, sin reenviar. */
  expireStale(tenantId: string, broadcastId: string, before: Date): Promise<number>;
  attempts(tenantId: string, broadcastId: string): Promise<{ readonly attempted: number; readonly failed: number }>;
  /** Lo que falta: pendientes con versión (por número), esperando al ganador, y en curso. */
  work(tenantId: string, broadcastId: string): Promise<{ readonly pendingByConnection: ReadonlyArray<string>; readonly held: number; readonly inFlight: number }>;
  assignHeld(tenantId: string, broadcastId: string, variant: number): Promise<number>;
  cancelPending(tenantId: string, broadcastId: string): Promise<number>;
  /** Mensajes de difusiones que salieron por el número desde `since` (todas las difusiones de la cuenta). */
  sentSince(tenantId: string, connectionId: string, since: Date): Promise<number>;
  /** Días distintos (en la zona del negocio) en que el número envió difusiones, hasta hoy incluido. */
  daysWithSends(tenantId: string, connectionId: string, timezone: string): Promise<number>;
}

export interface AudienceSource {
  /**
   * Quienes escribieron por alguno de esos números y cumplen los filtros (sin
   * el país, que se filtra por el prefijo), sin los que pidieron no recibir
   * más. Uno por cliente: el número por el que habló más reciente.
   */
  resolve(tenantId: string, audience: AudienceFilter, connectionIds: ReadonlyArray<string>, limit: number): Promise<{ readonly candidates: ReadonlyArray<Candidate>; readonly optedOut: number }>;
  /** Para el segundo envío: recibieron la difusión y no respondieron, ni compraron, ni pidieron salir. */
  nonResponders(tenantId: string, broadcastId: string, limit: number): Promise<ReadonlyArray<Candidate>>;
}

export interface OptOutStore {
  add(tenantId: string, phone: string, at: Date): Promise<void>;
  has(tenantId: string, phone: string): Promise<boolean>;
}

export interface BroadcastResults {
  stats(tenantId: string, broadcastIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, BroadcastStats>>;
  variants(tenantId: string, broadcastId: string): Promise<ReadonlyArray<VariantResult>>;
  recipients(tenantId: string, broadcastId: string, filter: RecipientFilter, offset: number, limit: number): Promise<RecipientsPage>;
}

export interface SavedAudienceRepository {
  list(tenantId: string): Promise<ReadonlyArray<SavedAudience>>;
  save(tenantId: string, audience: SavedAudience): Promise<void>;
  remove(tenantId: string, id: string): Promise<boolean>;
}

/** Envía de verdad (Mensajería): abre el chat, sale por el número y queda en la bandeja. */
export interface BroadcastSender {
  sendFlow(tenantId: string, target: Candidate, automationId: string): Promise<SendOutcome>;
  sendMessage(tenantId: string, target: Candidate, message: { readonly text: string; readonly media: BroadcastMedia | null }): Promise<SendOutcome>;
}

export interface SendOutcome {
  readonly ok: boolean;
  readonly providerMessageId: string | null;
  readonly error: string | null;
  /** Lo que se envía ya no se puede enviar a nadie (el flujo se borró o se archivó). */
  readonly blocked?: boolean;
}

/** Los números de la cuenta (Conexiones). */
export interface NumberDirectory {
  list(tenantId: string): Promise<ReadonlyArray<{ readonly id: string; readonly name: string; readonly connected: boolean; readonly canBroadcast: boolean }>>;
}

/** Los flujos de la cuenta (Automatizaciones). */
export interface FlowDirectory {
  find(tenantId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, { readonly name: string; readonly archived: boolean }>>;
}

/** La cola de tareas: cuándo sigue cada cosa. */
export interface BroadcastTicker {
  start(tenantId: string, broadcastId: string, at: Date): Promise<void>;
  /** El siguiente envío por ese número (una sola cadena por número). */
  tick(tenantId: string, broadcastId: string, connectionId: string, at: Date): Promise<void>;
  decide(tenantId: string, broadcastId: string, at: Date): Promise<void>;
  followUp(tenantId: string, broadcastId: string, at: Date): Promise<void>;
  /** Cancela todo lo programado de la difusión. */
  stop(tenantId: string, broadcastId: string, connectionIds: ReadonlyArray<string>): Promise<void>;
  /** La próxima tarea de la difusión, si hay. */
  next(tenantId: string, broadcastId: string): Promise<Date | null>;
}

export type TimezoneOf = (tenantId: string) => Promise<string>;

/** Suma de dinero por moneda, de mayor a menor. */
export function mergeMoney(amounts: ReadonlyArray<MoneyAmount>): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const { currency, amount } of amounts) totals.set(currency, (totals.get(currency) ?? 0) + amount);
  return [...totals].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
}
