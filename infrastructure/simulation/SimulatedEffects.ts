import type { AiGateway, AiGenerateRequest, AiGenerateResult } from "../../flow-engine/ports/AiGateway";
import type { ConversionTracker, TrackConversionRequest, TrackConversionResult } from "../../flow-engine/ports/ConversionTracker";
import type { HttpRequester, HttpSendResult, OutboundHttpRequest } from "../../flow-engine/ports/HttpRequester";
import type { SimulationJournal } from "../../domains/automations/simulation/domain/SimulationJournal";

// ---------------------------------------------------------------------------
// Efectos externos durante una prueba del editor. Lo que sale de Auream se
// anota en el recorrido y, salvo que se pida lo real, NO sale:
//
//   Pixel        nunca se envía a Meta (sería una conversión falsa en sus campañas)
//   Integración  respuesta 200 vacía sin llamar; o la petición real, anotada
//   IA           respuesta de prueba; o el modelo real, anotado
// ---------------------------------------------------------------------------

export class SimulatedConversionTracker implements ConversionTracker {
  public constructor(private readonly journal: SimulationJournal) {}

  public async track(_tenantId: string, request: TrackConversionRequest): Promise<TrackConversionResult> {
    const { name, value, currency } = request.event;
    this.journal.note(`Pixel: evento ${name}${value !== undefined ? ` por ${value} ${currency ?? ""}`.trimEnd() : ""} (en pruebas no se envía a Meta)`);
    return { ok: true, eventsReceived: 1 };
  }
}

export class SimulatedHttpRequester implements HttpRequester {
  public constructor(private readonly journal: SimulationJournal) {}

  public async send(request: OutboundHttpRequest): Promise<HttpSendResult> {
    this.journal.note(`Integración simulada: ${request.method} ${request.url} (no se llamó; respuesta 200 vacía)`);
    return { ok: true, response: { status: 200, headers: { "content-type": "application/json" }, body: "{}" }, durationMs: 0 };
  }
}

/** La petición real, anotada en el recorrido (método, dirección y resultado). */
export class JournaledHttpRequester implements HttpRequester {
  public constructor(
    private readonly inner: HttpRequester,
    private readonly journal: SimulationJournal
  ) {}

  public async send(request: OutboundHttpRequest): Promise<HttpSendResult> {
    const result = await this.inner.send(request);
    this.journal.note(`Integración real: ${request.method} ${request.url} → ${result.ok ? `${result.response.status} en ${result.durationMs} ms` : result.message}`);
    return result;
  }
}

export const SIMULATED_AI_REPLY = "(Respuesta de prueba: activa «Usar IA real» para ver la del modelo)";

export class SimulatedAiGateway implements AiGateway {
  public constructor(private readonly journal: SimulationJournal) {}

  public async generate(_tenantId: string, request: AiGenerateRequest): Promise<AiGenerateResult> {
    this.journal.note(`IA simulada (${request.model || "sin modelo"}): no se llamó al modelo`);
    return { ok: true, text: SIMULATED_AI_REPLY };
  }
}

/** El modelo real, anotado en el recorrido (modelo y tokens). */
export class JournaledAiGateway implements AiGateway {
  public constructor(
    private readonly inner: AiGateway,
    private readonly journal: SimulationJournal
  ) {}

  public async generate(tenantId: string, request: AiGenerateRequest): Promise<AiGenerateResult> {
    const result = await this.inner.generate(tenantId, request);
    const tokens = result.ok && result.usage ? ` · ${result.usage.inputTokens + result.usage.outputTokens} tokens` : "";
    this.journal.note(result.ok ? `IA real: ${request.model}${tokens}` : `IA real falló: ${result.message}`);
    return result;
  }
}
