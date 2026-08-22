/**
 * Contratos de disparo de automatizaciones.
 *
 * Modelan la frontera por la que un evento externo entra en la plataforma y
 * termina ejecutando un flow publicado:
 *
 *   EVENTO EXTERNO → TRIGGER → FLOW PUBLICADO → FLOW ENGINE → EJECUCIÓN
 *
 * Estos contratos son deliberadamente agnósticos del canal: no mencionan
 * WhatsApp, Meta ni QR. Connections traducirá cada canal concreto a un
 * `ExternalEvent`; el motor sólo conoce esta forma.
 *
 * Estado: PREPARADO. Existe el contrato y el mapeo a `InboundEnvelope`.
 * NO existe todavía ningún emisor de eventos ni almacén de bindings.
 */

// ---------------------------------------------------------------------------
// TriggerType
//
// Sólo se declara lo que la plataforma sabrá disparar en V1. No se añaden
// variantes especulativas: cada tipo nuevo debe llegar con su implementación.
// ---------------------------------------------------------------------------

export type TriggerType = "message_received";

// ---------------------------------------------------------------------------
// ExternalEvent
//
// Un hecho ocurrido fuera de la plataforma, ya normalizado por Connections.
// `connectionId` identifica la conexión externa que lo originó; el motor no
// sabe si detrás hay WhatsApp Web o Meta Cloud API.
// ---------------------------------------------------------------------------

export interface ExternalEvent {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly type: TriggerType;
  readonly channel: string;
  readonly conversationKey: string;
  readonly userKey: string;
  readonly eventId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

// ---------------------------------------------------------------------------
// TriggerBinding
//
// La regla que une un evento con el flow que debe ejecutarse. Es lo que
// Automations configurará cuando el usuario defina el trigger de un flow.
// ---------------------------------------------------------------------------

export interface TriggerBinding {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly type: TriggerType;
  readonly flowKey: string;
  readonly isEnabled: boolean;
}
