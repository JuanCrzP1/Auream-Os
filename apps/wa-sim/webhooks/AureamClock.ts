import type { SimulatorStore } from "../core/SimulatorStore";
import type { SimInstance } from "../core/types";

// ---------------------------------------------------------------------------
// «Adelantar el tiempo»: le pide a Auream (`/dev/simulator/advance`, solo
// existe con el simulador) que corra ya lo que el flujo de un chat esperaba:
// Programador, «Tiempo agotado» de Esperar respuesta o Menú, pausas largas.
//
// Se autentica con el token del número (como los avisos) y llega a la misma
// API que recibe los avisos: la dirección sale de la que Auream configuró.
// ---------------------------------------------------------------------------

const WEBHOOK_SUFFIX = /\/webhooks\/uazapi\/?$/;
const PREFIX = "auream-";

export interface AdvanceResult {
  readonly ok: boolean;
  /** Cuándo iba a correr lo que se adelantó (vacío: el chat no esperaba nada). */
  readonly advanced: ReadonlyArray<string>;
  readonly error?: string;
}

export class AureamClock {
  public constructor(
    private readonly store: SimulatorStore,
    private readonly fallbackWebhookUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  public async advance(instance: SimInstance, phone: string): Promise<AdvanceResult> {
    if (!instance.name.startsWith(PREFIX)) return { ok: false, advanced: [], error: "Este número no es una conexión de Auream." };
    const base = (instance.webhookUrl ?? this.fallbackWebhookUrl).replace(WEBHOOK_SUFFIX, "");
    try {
      const response = await this.fetchImpl(`${base}/dev/simulator/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId: instance.name.slice(PREFIX.length), token: instance.token, phone }),
        signal: AbortSignal.timeout(10_000)
      });
      const data = (await response.json().catch(() => ({}))) as { advanced?: string[]; message?: string };
      if (!response.ok) {
        const error = response.status === 404 ? "Auream no tiene activo el simulador (WHATSAPP_SIMULATOR_URL)." : data.message ?? `Auream respondió ${response.status}.`;
        this.store.record("out", `adelantar el tiempo de +${phone}: ${error}`, false);
        return { ok: false, advanced: [], error };
      }
      const advanced = data.advanced ?? [];
      this.store.record("out", `adelantar el tiempo de +${phone}: ${advanced.length ? `corre ya lo que esperaba hasta ${advanced.join(", ")}` : "no esperaba nada"}`);
      return { ok: true, advanced };
    } catch (error) {
      const message = `Auream no respondió (${error instanceof Error ? error.message : "error"}).`;
      this.store.record("out", `adelantar el tiempo de +${phone}: ${message}`, false);
      return { ok: false, advanced: [], error: message };
    }
  }
}
