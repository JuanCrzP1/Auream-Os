import type { BuilderFlowSnapshot } from "./FlowSnapshot";
import type { ContactFieldValue } from "./ContactContracts";
import type { Session } from "./RuntimeContracts";

// ---------------------------------------------------------------------------
// Laboratorio de pruebas del editor: contrato entre la API y la web.
//
// Se prueba EXACTAMENTE lo que está en el lienzo (`draft`, aunque no se haya
// guardado) contra un cliente de prueba, sin enviar nada por WhatsApp ni
// tocar contactos reales. La prueba no vive en el servidor: el navegador
// guarda su estado y lo manda en cada turno (en Vercel cada petición puede
// caer en una instancia distinta).
// ---------------------------------------------------------------------------

/** El cliente con el que se prueba (nombre, teléfono, etiquetas, campos). */
export interface SimulationPersona {
  readonly name: string;
  /** Solo dígitos, con indicativo. */
  readonly phone: string;
  readonly email: string;
  readonly tags: ReadonlyArray<string>;
  readonly fields: Readonly<Record<string, ContactFieldValue>>;
}

/** Qué se hace de verdad durante la prueba. Nunca se envía WhatsApp ni se manda el Pixel a Meta. */
export interface SimulationOptions {
  /** La «Extensión IA» llama al modelo con la conexión de la cuenta (gasta tokens). */
  readonly realAi: boolean;
  /** La «Integración» hace la petición HTTP de verdad (si no, responde 200 vacío). */
  readonly realIntegrations: boolean;
}

/** Un temporizador pendiente (Programador o tiempo máximo de una espera). */
export interface SimulationWait {
  readonly reason: "resume" | "timeout";
  readonly nodeId: string;
  readonly revision: number;
  /** Cuándo vencería en la vida real. En la prueba se puede «saltar». */
  readonly until: string;
}

/** Estado de la prueba que guarda el navegador entre turnos. */
export interface SimulationState {
  readonly session: Session | null;
  readonly persona: SimulationPersona;
  readonly wait: SimulationWait | null;
  /** Turnos del Distribuidor durante la prueba (para que reparta como en la vida real). */
  readonly counters: Readonly<Record<string, number>>;
}

export type SimulationEvent =
  | { readonly type: "start" }
  | { readonly type: "message"; readonly text: string }
  /** Tocar una opción de un menú (botón o lista). */
  | { readonly type: "choice"; readonly optionId: string; readonly title: string }
  /** Adelantar el temporizador pendiente. */
  | { readonly type: "skip-wait" };

export interface SimulationTurnRequest {
  readonly draft: BuilderFlowSnapshot;
  readonly state: SimulationState | null;
  readonly event: SimulationEvent;
  readonly options: SimulationOptions;
}

/** Cómo quedó la prueba después del turno. */
export type SimulationStatus = "waiting_reply" | "waiting_timer" | "finished" | "failed";

/** Un bloque por el que pasó el turno. */
export interface SimulationStep {
  readonly nodeId: string;
  readonly nodeName: string;
  readonly nodeType: string;
  /** `success` · `waiting_input` · `delayed` · `completed` · `failed`. */
  readonly status: string;
  /** Salida por la que siguió (id y nombre visible), si tiene varias. */
  readonly output: { readonly id: string; readonly label: string } | null;
  /** Lo que hizo, en lenguaje claro: «Etiqueta añadida: VIP», «Guardó nombre = Laura»… */
  readonly notes: ReadonlyArray<string>;
}

/**
 * Lo que el flujo le habría mandado al cliente (o al equipo), en orden. Las
 * pausas entre mensajes y el «escribiendo…» van también, con su duración real,
 * para reproducir la conversación como la vería el cliente en WhatsApp.
 */
export interface SimulatedMessage {
  readonly nodeId: string;
  readonly kind: "text" | "media" | "menu" | "reaction" | "notification" | "pause";
  readonly text: string;
  /** Con `kind: "pause"`: cuánto dura (ms). */
  readonly delayMs?: number;
  /** Con `kind: "pause"`: qué ve el cliente mientras tanto. */
  readonly presence?: "composing" | "recording";
  readonly media?: { readonly type: "image" | "video" | "audio" | "file"; readonly url: string; readonly fileName?: string };
  readonly menu?: {
    readonly format: "buttons" | "list";
    readonly header?: string;
    readonly footer?: string;
    readonly buttonLabel?: string;
    readonly options: ReadonlyArray<{ readonly id: string; readonly title: string; readonly description?: string }>;
  };
  /** Aviso al equipo: a quién iba. */
  readonly recipient?: { readonly name: string; readonly phone: string };
}

export interface SimulationTurnResponse {
  readonly state: SimulationState;
  readonly status: SimulationStatus;
  readonly steps: ReadonlyArray<SimulationStep>;
  readonly messages: ReadonlyArray<SimulatedMessage>;
  readonly wait: SimulationWait | null;
  /** Variables de la conversación (sin las internas). */
  readonly variables: Readonly<Record<string, unknown>>;
  /** Algo que conviene saber (p. ej. «el flujo cambió y la prueba empezó de nuevo»). */
  readonly notice: string | null;
}

export const DEFAULT_SIMULATION_PERSONA: SimulationPersona = {
  name: "Cliente de prueba",
  phone: "573000000000",
  email: "",
  tags: [],
  fields: {}
};
