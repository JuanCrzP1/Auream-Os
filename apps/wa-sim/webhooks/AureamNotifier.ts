import type { SimulatorStore } from "../core/SimulatorStore";
import type { SimInstance } from "../core/types";

// ---------------------------------------------------------------------------
// Envía los avisos del simulador a Auream (como hace uazapi con su webhook):
// a la dirección que Auream configuró con POST /webhook, o a la de respaldo
// (`SIM_WEBHOOK_URL`) si aún no configuró ninguna. Solo los eventos que
// Auream pidió. Un fallo queda en el registro; nunca tumba el simulador.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const TIMEOUT_MS = 10_000;

export class AureamNotifier {
  public constructor(
    private readonly store: SimulatorStore,
    private readonly fallbackUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /** Avisa y espera la respuesta de Auream. `true` si Auream respondió 2xx. */
  public async send(instance: SimInstance, event: Json): Promise<boolean> {
    const type = String(event["EventType"] ?? "");
    if (instance.webhookUrl && instance.webhookEvents.length > 0 && !instance.webhookEvents.includes(type)) {
      this.store.record("out", `${type}: Auream no pidió este aviso`, true);
      return false;
    }
    const url = instance.webhookUrl ?? this.fallbackUrl;
    try {
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      this.store.record("out", `${type} → Auream (${response.status})`, response.ok);
      return response.ok;
    } catch (error) {
      this.store.record("out", `${type} → Auream: no respondió (${error instanceof Error ? error.message : "error"})`, false);
      return false;
    }
  }
}
